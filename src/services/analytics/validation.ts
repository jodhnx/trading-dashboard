import { z } from "zod";
import { symbolSchema } from "@/services/market/schemas";
import { ANALYTICS_DATASETS, ANALYTICS_PRESETS, ANALYTICS_SYMBOLS } from "./constants";

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.");

export const analyticsQuerySchema = z
  .object({
    preset: z.enum(ANALYTICS_PRESETS).optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    symbol: z
      .union([z.literal("ALL"), symbolSchema])
      .optional()
      .transform((value) => value ?? "ALL"),
    dataset: z.enum(ANALYTICS_DATASETS).optional().default("all"),
  })
  .superRefine((value, ctx) => {
    if (value.symbol && value.symbol !== "ALL") {
      const allowed = ANALYTICS_SYMBOLS.filter((item) => item !== "ALL");
      if (!allowed.includes(value.symbol as (typeof allowed)[number])) {
        ctx.addIssue({
          code: "custom",
          path: ["symbol"],
          message: "Unsupported symbol filter.",
        });
      }
    }
    if (value.from && value.to) {
      const fromMs = Date.parse(`${value.from}T00:00:00.000Z`);
      const toMs = Date.parse(`${value.to}T00:00:00.000Z`);
      if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) {
        ctx.addIssue({
          code: "custom",
          path: ["to"],
          message: "Invalid custom date range.",
        });
      }
    }
    if ((value.from || value.to) && value.preset) {
      ctx.addIssue({
        code: "custom",
        path: ["preset"],
        message: "Use either preset or custom dates, not both.",
      });
    }
  });

export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;
