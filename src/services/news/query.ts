import { z } from "zod";
import { NEWS_CATEGORIES } from "@/types/enums";
import { symbolSchema } from "@/services/market/schemas";
import { DEFAULT_NEWS_LIMIT, MAX_NEWS_LIMIT } from "./ttl";

export const newsLimitSchema = z.coerce
  .number()
  .int()
  .min(1, "limit must be at least 1")
  .max(MAX_NEWS_LIMIT, `limit cannot exceed ${MAX_NEWS_LIMIT}`);

export const newsCategorySchema = z.enum(NEWS_CATEGORIES);

function parseOptionalDate(raw: string | null): Date | undefined | { error: string } {
  if (raw === null || raw.trim() === "") {
    return undefined;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { error: "Invalid from/to timestamp" };
  }
  return parsed;
}

export function parseNewsQuery(input: {
  asset: string | null;
  category: string | null;
  limit: string | null;
  from: string | null;
  to: string | null;
}):
  | {
      ok: true;
      asset?: string;
      category?: (typeof NEWS_CATEGORIES)[number];
      limit: number;
      from?: Date;
      to?: Date;
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
    const parsed = newsCategorySchema.safeParse(input.category.trim().toUpperCase());
    if (!parsed.success) {
      return { ok: false, error: "Invalid category" };
    }
    category = parsed.data;
  }

  const limit = newsLimitSchema.safeParse(
    input.limit && input.limit.length > 0 ? input.limit : DEFAULT_NEWS_LIMIT,
  );
  if (!limit.success) {
    return { ok: false, error: limit.error.issues[0]?.message ?? "Invalid limit" };
  }

  const from = parseOptionalDate(input.from);
  if (from && "error" in from) {
    return { ok: false, error: from.error };
  }
  const to = parseOptionalDate(input.to);
  if (to && "error" in to) {
    return { ok: false, error: to.error };
  }

  if (from instanceof Date && to instanceof Date && from.getTime() > to.getTime()) {
    return { ok: false, error: "from must be before to" };
  }

  return {
    ok: true,
    asset,
    category,
    limit: limit.data,
    from: from instanceof Date ? from : undefined,
    to: to instanceof Date ? to : undefined,
  };
}
