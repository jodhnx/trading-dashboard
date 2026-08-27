import { EnvValidationError } from "@/lib/env/errors";
import { NewsUnavailableError } from "./errors";
import type { NewsItem } from "./types";
import type { NewsProvider } from "./provider";
import { newsContentHash } from "./hash";
import { mapNewsAssets, buildBroadNewsQuery } from "./mapping";
import { classifyCategory, classifyRelevance, classifySentiment } from "./classify";
import { validateRawNews } from "./validation";
import { newsQueryForAsset } from "./mapping";
import { NEWS_PROVIDER_TIMEOUT_MS } from "./ttl";
import { normalizeInternalSymbol } from "@/services/market/symbols";

const SOURCE_ID = "newsapi";
const BASE_URL = "https://newsapi.org/v2";
const LATEST_QUERY = buildBroadNewsQuery();

type NewsApiArticle = {
  source?: { id?: string | null; name?: string | null };
  title?: unknown;
  description?: unknown;
  url?: unknown;
  publishedAt?: unknown;
};

type NewsApiResponse = {
  status?: string;
  code?: string;
  message?: string;
  articles?: unknown;
};

export class NewsApiProvider implements NewsProvider {
  readonly id = SOURCE_ID;
  readonly isMock = false;

  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (!apiKey.trim()) {
      throw new EnvValidationError("NEWS_API_KEY is empty.");
    }
  }

  async getLatestNews(): Promise<NewsItem[]> {
    return this.searchEverything(LATEST_QUERY);
  }

  async getAssetNews(symbol: string): Promise<NewsItem[]> {
    const query = newsQueryForAsset(normalizeInternalSymbol(symbol));
    if (!query) {
      return [];
    }
    return this.searchEverything(query);
  }

  async getMarketNews(): Promise<NewsItem[]> {
    return this.request("/top-headlines", {
      category: "business",
      language: "en",
      pageSize: "50",
    });
  }

  private async searchEverything(query: string): Promise<NewsItem[]> {
    return this.request("/everything", {
      q: query,
      language: "en",
      sortBy: "publishedAt",
      pageSize: "50",
    });
  }

  private async request(
    path: string,
    params: Record<string, string>,
  ): Promise<NewsItem[]> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    let response: Response;
    try {
      response = await this.fetchFn(url.toString(), {
        cache: "no-store",
        headers: {
          "X-Api-Key": this.apiKey,
        },
        signal: AbortSignal.timeout(NEWS_PROVIDER_TIMEOUT_MS),
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.name === "TimeoutError"
          ? "timeout"
          : "api_error";
      throw new NewsUnavailableError("NEWS UNAVAILABLE", {
        provider: this.id,
        reason,
      });
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new NewsUnavailableError("NEWS UNAVAILABLE", {
        provider: this.id,
        reason: "malformed",
      });
    }

    const body = (payload ?? {}) as NewsApiResponse;
    if (response.status === 429 || body.code === "rateLimited") {
      throw new NewsUnavailableError("NEWS UNAVAILABLE", {
        provider: this.id,
        reason: "rate_limit",
      });
    }
    if (!response.ok || body.status === "error") {
      throw new NewsUnavailableError("NEWS UNAVAILABLE", {
        provider: this.id,
        reason:
          response.status === 429 || body.code === "rateLimited"
            ? "rate_limit"
            : "api_error",
      });
    }
    if (!Array.isArray(body.articles)) {
      throw new NewsUnavailableError("NEWS UNAVAILABLE", {
        provider: this.id,
        reason: "malformed",
      });
    }

    const retrievedAt = this.now();
    const items: NewsItem[] = [];
    for (const raw of body.articles) {
      const item = normalizeArticle(raw, retrievedAt);
      if (item) {
        items.push(item);
      }
    }
    return items;
  }
}

function normalizeArticle(raw: unknown, retrievedAt: Date): NewsItem | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const article = raw as NewsApiArticle;
  const sourceName =
    typeof article.source?.name === "string" ? article.source.name : "";
  const validated = validateRawNews({
    title: article.title,
    sourceName,
    sourceUrl: article.url,
    publishedAt: article.publishedAt,
    summary: typeof article.description === "string" ? article.description : null,
  });
  if (!validated) {
    return null;
  }

  const text = `${validated.title} ${validated.summary ?? ""}`;
  const mapped = mapNewsAssets(text);
  return {
    id: newsContentHash({
      title: validated.title,
      sourceName: validated.sourceName,
      publishedAt: validated.publishedAt,
      sourceUrl: validated.sourceUrl,
    }),
    title: validated.title,
    summary: validated.summary ?? null,
    sourceName: validated.sourceName,
    sourceUrl: validated.sourceUrl,
    publishedAt: validated.publishedAt,
    retrievedAt,
    assetSymbols: mapped.symbols,
    category: classifyCategory(text),
    relevance: classifyRelevance(text),
    sentiment: classifySentiment(text),
    isMock: false,
    contentHash: newsContentHash({
      title: validated.title,
      sourceName: validated.sourceName,
      publishedAt: validated.publishedAt,
      sourceUrl: validated.sourceUrl,
    }),
  };
}
