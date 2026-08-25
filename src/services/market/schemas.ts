import { z } from "zod";
import { TIMEFRAMES } from "@/types/enums";

export const quoteSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().nullable(),
  exchange: z.string().nullable(),
  currency: z.string().nullable(),
  price: z.number().finite(),
  change: z.number().finite().nullable(),
  changePercent: z.number().finite().nullable(),
  open: z.number().finite().nullable(),
  high: z.number().finite().nullable(),
  low: z.number().finite().nullable(),
  previousClose: z.number().finite().nullable(),
  volume: z.number().finite().nullable(),
  timestamp: z.date(),
  dataTimestamp: z.date(),
  isMarketOpen: z.boolean().nullable().default(null),
  source: z.string().min(1),
  isMock: z.boolean(),
});

export const candleSchema = z.object({
  symbol: z.string().min(1),
  timestamp: z.date(),
  open: z.number().finite(),
  high: z.number().finite(),
  low: z.number().finite(),
  close: z.number().finite(),
  volume: z.number().finite().nullable(),
  timeframe: z.enum(TIMEFRAMES),
  source: z.string().min(1),
  isMock: z.boolean(),
});

export const volumeSchema = z.object({
  symbol: z.string().min(1),
  volume: z.number().finite().nullable(),
  averageVolume: z.number().finite().nullable(),
  timestamp: z.date(),
  source: z.string().min(1),
  isMock: z.boolean(),
});

export const symbolSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9./\-_]+$/, "Invalid symbol")
  .transform((value) => value.toUpperCase());

export const timeframeSchema = z.enum(TIMEFRAMES);

export const historyLimitSchema = z.coerce
  .number()
  .int()
  .min(1, "limit must be at least 1")
  .max(1000, "limit cannot exceed 1000");
