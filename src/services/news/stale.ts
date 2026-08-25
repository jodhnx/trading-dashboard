import { NEWS_STALE_AFTER_MS } from "./ttl";

export function isNewsStale(
  publishedAt: Date,
  now: Date = new Date(),
  staleAfterMs: number = NEWS_STALE_AFTER_MS,
): boolean {
  return now.getTime() - publishedAt.getTime() > staleAfterMs;
}
