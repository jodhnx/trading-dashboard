import { z } from "zod";
import { symbolSchema, timeframeSchema } from "@/services/market/schemas";

export const paperOpenSchema = z.object({
  symbol: symbolSchema,
  timeframe: timeframeSchema,
});

export type PaperOpenInput = z.infer<typeof paperOpenSchema>;
