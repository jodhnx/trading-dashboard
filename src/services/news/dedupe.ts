import { newsIdentityKey } from "./hash";

export function dedupeNews<T extends { contentHash: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    if (seen.has(item.contentHash)) {
      continue;
    }
    seen.add(item.contentHash);
    unique.push(item);
  }
  return unique;
}

export function dedupeByIdentity<
  T extends { title: string; sourceName: string; publishedAt: Date },
>(items: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    const key = newsIdentityKey(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }
  return unique;
}
