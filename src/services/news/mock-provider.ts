import type { NewsItem } from "./types";
import type { NewsProvider } from "./provider";
import { newsContentHash } from "./hash";
import { mapNewsAssets } from "./mapping";
import { classifyCategory, classifyRelevance } from "./classify";
import { normalizeInternalSymbol } from "@/services/market/symbols";

const SOURCE = "MOCK";
const SOURCE_HOST = "https://mock.news.local";

type Fixture = {
  slug: string;
  title: string;
  summary: string;
  hoursAgo: number;
};

const FIXTURES: Fixture[] = [
  {
    slug: "nvda-earnings",
    title: "[MOCK] NVIDIA quarterly results fixture",
    summary:
      "[MOCK] Deterministic NVIDIA earnings fixture for local development. Not a real headline.",
    hoursAgo: 2,
  },
  {
    slug: "btc-market",
    title: "[MOCK] Bitcoin market update fixture",
    summary:
      "[MOCK] Deterministic Bitcoin fixture for local development. Not a real headline.",
    hoursAgo: 4,
  },
  {
    slug: "fed-rates",
    title: "[MOCK] FOMC interest rate decision fixture",
    summary:
      "[MOCK] Deterministic Federal Reserve fixture. No unique company mapping.",
    hoursAgo: 6,
  },
  {
    slug: "spy-market",
    title: "[MOCK] S&P 500 stock market fixture",
    summary: "[MOCK] Deterministic S&P 500 market fixture. Not a real headline.",
    hoursAgo: 8,
  },
];

function toItem(fixture: Fixture, now: Date): NewsItem {
  const publishedAt = new Date(now.getTime() - fixture.hoursAgo * 60 * 60 * 1000);
  const sourceUrl = `${SOURCE_HOST}/${fixture.slug}`;
  const text = `${fixture.title} ${fixture.summary}`;
  const mapped = mapNewsAssets(text);
  return {
    id: `mock-${fixture.slug}`,
    title: fixture.title,
    summary: fixture.summary,
    sourceName: SOURCE,
    sourceUrl,
    publishedAt,
    retrievedAt: now,
    assetSymbols: mapped.symbols,
    category: classifyCategory(text),
    relevance: classifyRelevance(text),
    sentiment: "UNKNOWN",
    isMock: true,
    contentHash: newsContentHash({
      title: fixture.title,
      sourceName: SOURCE,
      publishedAt,
      sourceUrl,
    }),
  };
}

export class MockNewsProvider implements NewsProvider {
  readonly id = "mock";
  readonly isMock = true;

  constructor(private readonly now: () => Date = () => new Date()) {}

  async getLatestNews(): Promise<NewsItem[]> {
    const now = this.now();
    return FIXTURES.map((fixture) => toItem(fixture, now));
  }

  async getAssetNews(symbol: string): Promise<NewsItem[]> {
    const internal = normalizeInternalSymbol(symbol);
    const items = await this.getLatestNews();
    return items.filter((item) => item.assetSymbols.includes(internal));
  }

  async getMarketNews(): Promise<NewsItem[]> {
    const items = await this.getLatestNews();
    return items.filter((item) => item.assetSymbols.length === 0);
  }
}
