import { describe, expect, it } from "vitest";
import { MemoryCache } from "@/services/market/cache";
import { MockNewsProvider } from "./mock-provider";
import { NewsService } from "./news-service";
import { NewsUnavailableError } from "./errors";
import { newsContentHash } from "./hash";
import type { NewsProvider } from "./provider";
import type { NewsItem } from "./types";
import { newsIdentityKey } from "./hash";
import type { NewsListFilters, NewsPersistence, StoredNews } from "./types";
import { NEWS_CACHE_TTL_MS } from "./ttl";

class MemoryNewsPersistence implements NewsPersistence {
  readonly rows = new Map<string, StoredNews>();

  async upsertNews(items: StoredNews[]): Promise<StoredNews[]> {
    const stored: StoredNews[] = [];
    for (const item of items) {
      const row: StoredNews = {
        ...item,
        id: item.id.startsWith("mock-") ? `id-${item.contentHash.slice(0, 8)}` : item.id,
        assetId: item.assetSymbols[0] ?? null,
      };
      this.rows.set(row.contentHash, row);
      stored.push(row);
    }
    return stored;
  }

  async listNews(filters: NewsListFilters): Promise<StoredNews[]> {
    return [...this.rows.values()]
      .filter((item) => (filters.allowMock ? true : !item.isMock))
      .filter((item) => (filters.asset ? item.assetSymbols[0] === filters.asset : true))
      .filter((item) => (filters.category ? item.category === filters.category : true))
      .slice(0, filters.limit);
  }

  async getNewsById(id: string): Promise<StoredNews | null> {
    return [...this.rows.values()].find((item) => item.id === id) ?? null;
  }

  async existingHashes(hashes: string[]): Promise<Set<string>> {
    return new Set(hashes.filter((hash) => this.rows.has(hash)));
  }

  async existingIdentities(
    items: Array<{ title: string; sourceName: string; publishedAt: Date }>,
  ): Promise<Set<string>> {
    const stored = new Set(
      [...this.rows.values()].map((row) => newsIdentityKey(row)),
    );
    return new Set(items.map((item) => newsIdentityKey(item)).filter((key) => stored.has(key)));
  }
}

describe("NewsService", () => {
  const now = () => new Date("2026-08-24T16:00:00.000Z");

  it("ingests, deduplicates, maps assets, and serves cached lists", async () => {
    const persistence = new MemoryNewsPersistence();
    const cache = new MemoryCache<StoredNews[]>(() => now().getTime());
    const service = new NewsService(
      new MockNewsProvider(now),
      cache,
      persistence,
      null,
      null,
      true,
    );

    const first = await service.fetchLatestNews();
    expect(first.status).toBe("MOCK");
    expect(first.stored).toBeGreaterThan(0);
    expect(first.duplicates).toBe(0);

    const second = await service.fetchLatestNews();
    expect(second.stored).toBe(0);
    expect(second.duplicates).toBeGreaterThan(0);

    const listed = await service.listNews({ limit: 20 });
    expect(listed.items.some((item) => item.assetSymbols[0] === "NVDA")).toBe(true);
    expect(listed.items.some((item) => item.assetSymbols[0] === "BTC")).toBe(true);
    expect(listed.items.find((item) => /FOMC/i.test(item.title))?.assetSymbols).toEqual(
      [],
    );

    const cached = await service.listNews({ limit: 20 });
    expect(cached.items).toEqual(listed.items);
    expect(cache.get("news:::20:::mock")).toHaveLength(listed.items.length);
  });

  it("does not call the provider when listing stored news", async () => {
    const persistence = new MemoryNewsPersistence();
    const cache = new MemoryCache<StoredNews[]>();
    const provider = new MockNewsProvider(now);
    const original = provider.getLatestNews.bind(provider);
    let called = 0;
    provider.getLatestNews = async () => {
      called += 1;
      return original();
    };
    const service = new NewsService(provider, cache, persistence, null, null, true);
    await service.listNews({ limit: 10 });
    expect(called).toBe(0);
  });

  it("does not keep an empty list cached after news is stored", async () => {
    const persistence = new MemoryNewsPersistence();
    const cache = new MemoryCache<StoredNews[]>();
    const service = new NewsService(
      new MockNewsProvider(now),
      cache,
      persistence,
      null,
      null,
      true,
    );

    const empty = await service.listNews({ limit: 20 });
    expect(empty.items).toEqual([]);

    await service.fetchLatestNews();
    const listed = await service.listNews({ limit: 20 });
    expect(listed.items.length).toBeGreaterThan(0);
  });

  it("throws when no provider is configured", async () => {
    const service = new NewsService(
      null,
      new MemoryCache<StoredNews[]>(),
      new MemoryNewsPersistence(),
    );
    await expect(service.fetchLatestNews()).rejects.toBeInstanceOf(NewsUnavailableError);
  });

  it("respects the news list cache TTL", () => {
    let time = 0;
    const cache = new MemoryCache<string[]>(() => time);
    cache.set("news", ["a"], NEWS_CACHE_TTL_MS);
    expect(cache.get("news")).toEqual(["a"]);
    time = NEWS_CACHE_TTL_MS + 1;
    expect(cache.get("news")).toBeUndefined();
  });

  it("does not insert the same story again when only the URL differs", async () => {
    const publishedAt = new Date("2026-08-24T12:00:00.000Z");
    const story = (url: string, hash: string): NewsItem => ({
      id: hash,
      title: "Nvidia Earnings, Jackson Hole and Other Key Things to Watch this Week",
      summary: "Preview",
      sourceName: "Yahoo Finance",
      sourceUrl: url,
      publishedAt,
      retrievedAt: now(),
      assetSymbols: ["NVDA"],
      category: "EARNINGS",
      relevance: "HIGH",
      sentiment: "UNKNOWN",
      isMock: false,
      contentHash: hash,
    });

    const firstHash = newsContentHash({
      title: "Nvidia Earnings, Jackson Hole and Other Key Things to Watch this Week",
      sourceName: "Yahoo Finance",
      publishedAt,
      sourceUrl: "https://finance.yahoo.com/news/a?utm_source=rss",
    });
    const other: NewsItem = {
      id: "btc-1",
      title: "Bitcoin climbs after ETF inflows",
      summary: "Crypto",
      sourceName: "Reuters",
      sourceUrl: "https://www.reuters.com/btc",
      publishedAt,
      retrievedAt: now(),
      assetSymbols: ["BTC"],
      category: "CRYPTO",
      relevance: "MEDIUM",
      sentiment: "UNKNOWN",
      isMock: false,
      contentHash: newsContentHash({
        title: "Bitcoin climbs after ETF inflows",
        sourceName: "Reuters",
        publishedAt,
        sourceUrl: "https://www.reuters.com/btc",
      }),
    };

    const provider: NewsProvider = {
      id: "newsapi",
      isMock: false,
      async getLatestNews() {
        return [
          story("https://finance.yahoo.com/news/a?utm_source=rss", firstHash),
          story("https://finance.yahoo.com/news/a", firstHash),
          other,
        ];
      },
      async getAssetNews() {
        return [];
      },
      async getMarketNews() {
        return [story("https://news.yahoo.com/nvidia-earnings", "c".repeat(64))];
      },
    };

    const persistence = new MemoryNewsPersistence();
    const service = new NewsService(
      provider,
      new MemoryCache<StoredNews[]>(),
      persistence,
      null,
      null,
      false,
    );

    const first = await service.fetchLatestNews();
    expect(first.stored).toBe(2);
    expect(first.status).toBe("LIVE");

    const second = await service.fetchLatestNews();
    expect(second.stored).toBe(0);
    expect(second.duplicates).toBe(2);

    const listed = await service.listNews({ limit: 20 });
    const nvidia = listed.items.filter((item) => /Nvidia Earnings/i.test(item.title));
    expect(nvidia).toHaveLength(1);
    expect(nvidia[0]?.sourceUrl).toBe("https://finance.yahoo.com/news/a?utm_source=rss");
    expect(listed.items.some((item) => item.title.includes("Bitcoin"))).toBe(true);
  });
});
