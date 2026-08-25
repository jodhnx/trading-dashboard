import { z } from "zod";
import { symbolSchema } from "@/services/market/schemas";
import { MARKET_WATCHLIST, normalizeInternalSymbol } from "@/services/market/symbols";

const positiveFinite = z.coerce
  .number({ error: "Must be a finite number." })
  .refine((value) => Number.isFinite(value), "Must be a finite number.")
  .refine((value) => value > 0, "Must be greater than 0.");

export const holdingCreateSchema = z.object({
  symbol: symbolSchema,
  quantity: positiveFinite,
  averageEntryPrice: positiveFinite,
});

export const holdingPatchSchema = z
  .object({
    quantity: positiveFinite.optional(),
    averageEntryPrice: positiveFinite.optional(),
  })
  .refine(
    (value) => value.quantity !== undefined || value.averageEntryPrice !== undefined,
    "Provide quantity and/or averageEntryPrice.",
  );

export const cashUpdateSchema = z.object({
  cash: z.coerce
    .number({ error: "Cash must be a finite number." })
    .refine((value) => Number.isFinite(value), "Cash must be a finite number.")
    .refine((value) => value >= 0, "Cash cannot be negative."),
});

const ALLOWED_SYMBOLS = new Set(MARKET_WATCHLIST.map((asset) => asset.symbol));

export function isSupportedPortfolioSymbol(symbol: string): boolean {
  return ALLOWED_SYMBOLS.has(normalizeInternalSymbol(symbol));
}
