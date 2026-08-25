import { z } from "zod";

export const dailyBriefSummarySchema = z.object({
  summary: z.string().trim().min(1).max(4000),
  marketRegime: z.string().trim().min(1).max(80),
  riskEnvironment: z.string().trim().min(1).max(80),
  risks: z.array(z.string().trim().min(1).max(500)).max(20),
  notes: z.array(z.string().trim().min(1).max(500)).max(12),
});

export type DailyBriefSummary = z.infer<typeof dailyBriefSummarySchema>;

export const DAILY_BRIEF_SUMMARY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    marketRegime: { type: "string" },
    riskEnvironment: { type: "string" },
    risks: { type: "array", items: { type: "string" } },
    notes: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "marketRegime", "riskEnvironment", "risks", "notes"],
} as const;
