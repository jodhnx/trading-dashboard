import type { StoredNews } from "./types";
import { isNewsStale } from "./stale";

export function serializeNewsItem(item: StoredNews, now: Date = new Date()) {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    publishedAt: item.publishedAt.toISOString(),
    retrievedAt: item.retrievedAt.toISOString(),
    assetSymbols: item.assetSymbols,
    category: item.category,
    relevance: item.relevance,
    sentiment: item.sentiment,
    isMock: item.isMock,
    stale: isNewsStale(item.publishedAt, now),
  };
}
