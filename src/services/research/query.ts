import { z } from "zod";
import { IMPACT_LEVELS, NEWS_CATEGORIES } from "@/types/enums";
import { symbolSchema } from "@/services/market/schemas";
import { DEFAULT_NEWS_LIMIT, MAX_NEWS_LIMIT } from "@/services/news/ttl";

const limitSchema = z.coerce
  .number()
  .int()
  .min(1, "limit must be at least 1")
  .max(MAX_NEWS_LIMIT, `limit cannot exceed ${MAX_NEWS_LIMIT}`);

export function parseResearchQuery(input: {
  asset: string | null;
  category: string | null;
  relevance: string | null;
  limit: string | null;
}):
  | {
      ok: true;
      asset?: string;
      category?: (typeof NEWS_CATEGORIES)[number];
      relevance?: (typeof IMPACT_LEVELS)[number];
      limit: number;
    }
  | { ok: false; error: string } {
  let asset: string | undefined;
  if (input.asset && input.asset.trim() !== "") {
    const parsed = symbolSchema.safeParse(input.asset);
    if (!parsed.success) {
      return { ok: false, error: "Invalid asset" };
    }
    asset = parsed.data;
  }

  let category: (typeof NEWS_CATEGORIES)[number] | undefined;
  if (input.category && input.category.trim() !== "") {
    const parsed = z.enum(NEWS_CATEGORIES).safeParse(input.category.trim().toUpperCase());
    if (!parsed.success) {
      return { ok: false, error: "Invalid category" };
    }
    category = parsed.data;
  }

  let relevance: (typeof IMPACT_LEVELS)[number] | undefined;
  if (input.relevance && input.relevance.trim() !== "") {
    const parsed = z.enum(IMPACT_LEVELS).safeParse(input.relevance.trim().toUpperCase());
    if (!parsed.success) {
      return { ok: false, error: "Invalid relevance" };
    }
    relevance = parsed.data;
  }

  const limit = limitSchema.safeParse(
    input.limit && input.limit.length > 0 ? input.limit : DEFAULT_NEWS_LIMIT,
  );
  if (!limit.success) {
    return { ok: false, error: limit.error.issues[0]?.message ?? "Invalid limit" };
  }

  return { ok: true, asset, category, relevance, limit: limit.data };
}
