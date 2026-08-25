import type { ResearchItem } from "./types";
import { isNewsStale } from "@/services/news/stale";

export function serializeResearchItem(item: ResearchItem, now: Date = new Date()) {
  return {
    id: item.id,
    newsId: item.newsId,
    headline: item.headline,
    summary: item.summary,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    assetSymbol: item.assetSymbol,
    category: item.category,
    relevance: item.relevance,
    sentiment: item.sentiment,
    publishedAt: item.publishedAt?.toISOString() ?? null,
    retrievedAt: item.retrievedAt.toISOString(),
    researchStatus: item.researchStatus,
    informationType: item.informationType,
    aiSummary: item.aiSummary,
    stale: item.publishedAt ? isNewsStale(item.publishedAt, now) : false,
  };
}
