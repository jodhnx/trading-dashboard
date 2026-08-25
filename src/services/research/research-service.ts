import type { NewsItem, StoredNews } from "@/services/news/types";
import type { ResearchItem, ResearchListFilters, ResearchPersistence } from "./types";
import { AI_SUMMARY_UNAVAILABLE } from "@/ai/schemas/news-summary";
import type { NewsSummaryResult } from "@/ai/schemas/news-summary";

export class ResearchService {
  constructor(private readonly persistence: ResearchPersistence | null) {}

  fromNews(
    news: StoredNews | NewsItem,
    ai: NewsSummaryResult | null = null,
  ): ResearchItem {
    const newsId = "assetId" in news ? news.id : news.id;
    return {
      id: news.contentHash,
      newsId,
      headline: news.title,
      summary: news.summary,
      sourceName: news.sourceName,
      sourceUrl: news.sourceUrl,
      assetSymbol: news.assetSymbols[0] ?? null,
      category: news.category,
      relevance: news.relevance,
      sentiment: news.sentiment,
      publishedAt: news.publishedAt,
      retrievedAt: news.retrievedAt,
      researchStatus: "NEW",
      informationType: ai?.status === "ok" ? "AI_INTERPRETATION" : "FACT",
      aiSummary:
        ai === null
          ? null
          : ai.status === "ok"
            ? ai.summary
            : AI_SUMMARY_UNAVAILABLE,
    };
  }

  async persistFromNews(
    news: StoredNews,
    ai: NewsSummaryResult | null = null,
  ): Promise<ResearchItem> {
    const item = this.fromNews(news, ai);
    if (!this.persistence) {
      return item;
    }
    return this.persistence.upsertFromNews(item);
  }

  async list(filters: ResearchListFilters): Promise<ResearchItem[]> {
    if (!this.persistence) {
      return [];
    }
    return this.persistence.listResearch(filters);
  }

  async getByNewsId(newsId: string): Promise<ResearchItem | null> {
    if (!this.persistence) {
      return null;
    }
    return this.persistence.getByNewsId(newsId);
  }
}
