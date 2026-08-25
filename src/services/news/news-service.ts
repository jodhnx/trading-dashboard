import { MemoryCache } from "@/services/market/cache";
import type { NewsProvider } from "./provider";
import type {
  NewsIngestResult,
  NewsListFilters,
  NewsListResult,
  NewsPersistence,
  StoredNews,
} from "./types";
import type { NewsItem } from "./types";
import { NEWS_CACHE_TTL_MS, MAX_INGEST_AI_SUMMARIES } from "./ttl";
import { NewsUnavailableError } from "./errors";
import { dedupeByIdentity, dedupeNews } from "./dedupe";
import { newsIdentityKey } from "./hash";
import { sortNewsByRelevanceThenTime } from "./classify";
import type { ResearchService } from "@/services/research/research-service";
import type { NewsSummaryResult } from "@/ai/schemas/news-summary";
import { normalizeInternalSymbol } from "@/services/market/symbols";

export type NewsSummarizer = (item: NewsItem) => Promise<NewsSummaryResult>;

export class NewsService {
  constructor(
    private readonly provider: NewsProvider | null,
    private readonly cache: MemoryCache<StoredNews[]>,
    private readonly persistence: NewsPersistence | null,
    private readonly research: ResearchService | null = null,
    private readonly summarize: NewsSummarizer | null = null,
    private readonly allowMock: boolean = false,
  ) {}

  async listNews(
    filters: Omit<NewsListFilters, "allowMock"> & { allowMock?: boolean },
  ): Promise<NewsListResult> {
    const allowMock = filters.allowMock ?? this.allowMock;
    const resolved: NewsListFilters = {
      asset: filters.asset ? normalizeInternalSymbol(filters.asset) : undefined,
      category: filters.category,
      limit: filters.limit,
      from: filters.from,
      to: filters.to,
      allowMock,
    };
    const cacheKey = listCacheKey(resolved);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.length > 0) {
      return {
        items: cached,
        status: this.statusFromItems(cached),
        source: this.provider?.id ?? "store",
      };
    }

    const loaded = collapseStoredDuplicates(
      sortNewsByRelevanceThenTime(
        (await this.persistence?.listNews(resolved)) ?? [],
      ),
    );
    this.cache.set(cacheKey, loaded, NEWS_CACHE_TTL_MS);
    return {
      items: loaded,
      status: this.statusFromItems(loaded),
      source: loaded[0]?.isMock ? "mock" : (this.provider?.id ?? "store"),
    };
  }

  async getNewsById(id: string): Promise<StoredNews | null> {
    return (await this.persistence?.getNewsById(id)) ?? null;
  }

  /**
   * Provider ingest for cron / authenticated refresh.
   * Do not call from a normal page render.
   */
  async fetchLatestNews(): Promise<NewsIngestResult> {
    if (!this.provider) {
      throw new NewsUnavailableError("NEWS UNAVAILABLE", {
        reason: "unconfigured",
      });
    }

    const collected: NewsItem[] = [];
    let providerOk = false;
    try {
      const latest = await this.provider.getLatestNews();
      collected.push(...latest);
      providerOk = true;
    } catch (error) {
      if (!(error instanceof NewsUnavailableError)) {
        throw error;
      }
    }

    try {
      const market = await this.provider.getMarketNews();
      collected.push(...market);
      providerOk = true;
    } catch (error) {
      if (!(error instanceof NewsUnavailableError)) {
        throw error;
      }
    }

    if (!providerOk) {
      throw new NewsUnavailableError("NEWS UNAVAILABLE", {
        provider: this.provider.id,
        reason: "api_error",
      });
    }

    const unique = dedupeNews(dedupeByIdentity(collected));
    const hashes = unique.map((item) => item.contentHash);
    const existingHashes = (await this.persistence?.existingHashes(hashes)) ?? new Set();
    const existingIdentities =
      (await this.persistence?.existingIdentities(unique)) ?? new Set();
    const fresh = unique.filter((item) => {
      if (existingHashes.has(item.contentHash)) {
        return false;
      }
      return !existingIdentities.has(newsIdentityKey(item));
    });
    const rejected = collected.length - unique.length;
    const duplicates = unique.length - fresh.length;

    const persistable: StoredNews[] = fresh.map((item) => ({
      ...item,
      assetId: null,
    }));

    const stored =
      persistable.length > 0
        ? ((await this.persistence?.upsertNews(persistable)) ?? persistable)
        : [];

    try {
      await this.afterStore(stored);
    } catch {
      // Research / AI must not hide a successful news ingest.
    }
    this.cache.clear();

    return {
      fetched: collected.length,
      stored: stored.length,
      duplicates,
      rejected,
      status: this.provider.isMock ? "MOCK" : "LIVE",
      source: this.provider.id,
    };
  }

  private async afterStore(stored: StoredNews[]): Promise<void> {
    if (!this.research) {
      return;
    }
    let aiBudget = MAX_INGEST_AI_SUMMARIES;
    for (const item of stored) {
      let ai: NewsSummaryResult | null = null;
      if (
        this.summarize &&
        aiBudget > 0 &&
        (item.relevance === "HIGH" || item.relevance === "CRITICAL")
      ) {
        aiBudget -= 1;
        try {
          ai = await this.summarize(item);
        } catch {
          ai = null;
        }
      }
      await this.research.persistFromNews(item, ai);
    }
  }

  private statusFromItems(items: StoredNews[]): NewsListResult["status"] {
    if (this.provider?.isMock) {
      return "MOCK";
    }
    if (items.some((item) => item.isMock) && this.allowMock) {
      return "MOCK";
    }
    if (items.length === 0 && !this.provider) {
      return "UNAVAILABLE";
    }
    return "LIVE";
  }
}

function collapseStoredDuplicates(items: StoredNews[]): StoredNews[] {
  return dedupeByIdentity(items);
}

function listCacheKey(filters: NewsListFilters): string {
  return [
    "news",
    filters.asset ?? "",
    filters.category ?? "",
    String(filters.limit),
    filters.from?.toISOString() ?? "",
    filters.to?.toISOString() ?? "",
    filters.allowMock ? "mock" : "live",
  ].join(":");
}
