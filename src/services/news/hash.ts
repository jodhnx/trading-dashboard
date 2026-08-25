import { createHash } from "node:crypto";

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeSource(source: string): string {
  return source.trim().toLowerCase();
}

/** UTC calendar day. Avoids duplicate rows when APIs disagree on seconds. */
export function canonicalPublishedDay(publishedAt: Date): string {
  return publishedAt.toISOString().slice(0, 10);
}

/**
 * Conservative identity for the same wire story.
 * Same normalized title + source + UTC day = same item.
 * Different sources or different days stay distinct.
 * URL is stored on first insert and is not part of identity
 * (tracking params / alternate links must not create a new row).
 */
export function newsIdentityKey(input: {
  title: string;
  sourceName: string;
  publishedAt: Date;
}): string {
  return [
    normalizeTitle(input.title),
    normalizeSource(input.sourceName),
    canonicalPublishedDay(input.publishedAt),
  ].join("|");
}

export function newsContentHash(input: {
  title: string;
  sourceName: string;
  publishedAt: Date;
  sourceUrl?: string;
}): string {
  return createHash("sha256").update(newsIdentityKey(input)).digest("hex");
}
