import type { NewsFreshness } from "./types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function classifyNewsFreshness(
  publishedAt: Date,
  now: Date,
): NewsFreshness {
  const age = now.getTime() - publishedAt.getTime();
  if (!Number.isFinite(age) || age < 0) {
    return "STALE";
  }
  if (age < DAY) {
    return "CURRENT";
  }
  if (age < 7 * DAY) {
    return "RECENT";
  }
  if (age < 30 * DAY) {
    return "OLDER";
  }
  return "STALE";
}
