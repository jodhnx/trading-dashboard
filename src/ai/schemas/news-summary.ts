import { z } from "zod";
import { IMPACT_LEVELS, NEWS_CATEGORIES, SENTIMENTS } from "@/types/enums";

export const NEWS_SUMMARY_ASSETS = [
  "SPY",
  "QQQ",
  "NVDA",
  "BTC",
  "XAU",
  "USD",
] as const;

export const newsSummarySchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  category: z.enum(NEWS_CATEGORIES),
  sentiment: z.enum(SENTIMENTS),
  relevance: z.enum(IMPACT_LEVELS),
  affectedAssets: z.array(z.enum(NEWS_SUMMARY_ASSETS)).max(6),
  keyPoints: z.array(z.string().trim().min(1).max(400)).max(8),
  uncertainties: z.array(z.string().trim().min(1).max(400)).max(8),
});

export type NewsSummary = z.infer<typeof newsSummarySchema>;

export const AI_SUMMARY_UNAVAILABLE = "AI_SUMMARY_UNAVAILABLE" as const;
export type AiSummaryUnavailable = typeof AI_SUMMARY_UNAVAILABLE;

export type NewsSummaryResult =
  | { status: "ok"; summary: NewsSummary }
  | { status: typeof AI_SUMMARY_UNAVAILABLE; summary: null };
