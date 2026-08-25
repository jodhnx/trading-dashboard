import { z } from "zod";
import { symbolSchema } from "@/services/market/schemas";
import { POSITION_SIDES } from "@/types/enums";

const rating = z.coerce
  .number()
  .refine((value) => Number.isFinite(value), "Rating must be finite.")
  .refine((value) => value >= 0 && value <= 10, "Rating must be between 0 and 10.")
  .nullable()
  .optional();

const optionalFinite = z.coerce
  .number()
  .refine((value) => Number.isFinite(value), "Must be a finite number.")
  .nullable()
  .optional();

const optionalPositiveFinite = z.coerce
  .number()
  .refine((value) => Number.isFinite(value), "Must be a finite number.")
  .refine((value) => value > 0, "Must be greater than 0.")
  .nullable()
  .optional();

const shortText = z
  .string()
  .trim()
  .max(500, "Text is too long.")
  .nullable()
  .optional();

const longText = z
  .string()
  .trim()
  .max(4000, "Text is too long.")
  .nullable()
  .optional();

export const journalTagsSchema = z
  .array(z.string().trim().min(1).max(32))
  .max(20, "Too many tags.")
  .optional();

export const journalReviewSchema = z.object({
  setupRating: rating,
  executionRating: rating,
  disciplineRating: rating,
  emotionalState: shortText,
  mistakeType: shortText,
  lesson: longText,
  whatWentWell: longText,
  whatWentWrong: longText,
  notes: longText,
  tags: journalTagsSchema,
});

export const journalManualCreateSchema = journalReviewSchema.extend({
  symbol: symbolSchema.nullable().optional(),
  side: z.enum(POSITION_SIDES).nullable().optional(),
  entryPrice: optionalFinite,
  exitPrice: optionalFinite,
  quantity: optionalPositiveFinite,
  realizedPnL: optionalFinite,
  realizedPnLPercent: optionalFinite,
  entryTime: z.string().datetime().nullable().optional(),
  exitTime: z.string().datetime().nullable().optional(),
});

export const journalPatchSchema = journalReviewSchema.partial();

export const journalFromPaperTradeSchema = z.object({
  paperTradeId: z.string().uuid(),
  ...journalReviewSchema.shape,
});

export const journalListQuerySchema = z.object({
  symbol: symbolSchema.optional(),
  side: z.enum(POSITION_SIDES).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD.")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD.")
    .optional(),
  tag: z.string().trim().min(1).max(32).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
