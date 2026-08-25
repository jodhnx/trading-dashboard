import { z } from "zod";

const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "URL must be http or https");

export const rawNewsInputSchema = z.object({
  title: z.string().trim().min(1),
  sourceName: z.string().trim().min(1),
  sourceUrl: httpUrlSchema,
  publishedAt: z.date(),
  summary: z.string().trim().min(1).nullable().optional(),
});

export type RawNewsInput = z.infer<typeof rawNewsInputSchema>;

const REMOVED_TITLES = new Set(["[removed]", "removed"]);

export function parsePublishedAt(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function validateRawNews(input: {
  title?: unknown;
  sourceName?: unknown;
  sourceUrl?: unknown;
  publishedAt?: unknown;
  summary?: unknown;
}): RawNewsInput | null {
  const publishedAt = parsePublishedAt(input.publishedAt);
  if (!publishedAt) {
    return null;
  }

  const title = typeof input.title === "string" ? input.title : "";
  if (REMOVED_TITLES.has(title.trim().toLowerCase())) {
    return null;
  }

  const parsed = rawNewsInputSchema.safeParse({
    title: input.title,
    sourceName: input.sourceName,
    sourceUrl: input.sourceUrl,
    publishedAt,
    summary:
      typeof input.summary === "string" && input.summary.trim()
        ? input.summary.trim()
        : null,
  });

  return parsed.success ? parsed.data : null;
}
