import { z } from "zod";
import { ANALYSIS_DECISIONS } from "@/types/enums";
import { NEWS_IMPACTS, TIME_HORIZONS } from "./types";

const nullableNumber = z.number().finite().nullable();

export const analysisSetupReferenceSchema = z.object({
  entry: nullableNumber,
  stopLoss: nullableNumber,
  takeProfit: nullableNumber,
  riskReward: nullableNumber,
  positionSize: nullableNumber,
});

export const tradingAnalysisOutputSchema = z.object({
  decision: z.enum(ANALYSIS_DECISIONS),
  confidence: z.number().finite().min(0).max(100),
  summary: z.string().trim().min(1).max(4000),
  thesis: z.array(z.string().trim().min(1).max(500)).max(12),
  risks: z.array(z.string().trim().min(1).max(500)).max(12),
  uncertainties: z.array(z.string().trim().min(1).max(500)).max(12),
  supportingSignals: z.array(z.string().trim().min(1).max(500)).max(12),
  contradictingSignals: z.array(z.string().trim().min(1).max(500)).max(12),
  newsImpact: z.enum(NEWS_IMPACTS),
  timeHorizon: z.enum(TIME_HORIZONS),
  setupReference: analysisSetupReferenceSchema,
  usedNewsIds: z.array(z.string().trim().min(1).max(80)).max(10),
});

export type ParsedTradingAnalysis = z.infer<typeof tradingAnalysisOutputSchema>;

const nullableNumberJson = {
  anyOf: [{ type: "number" }, { type: "null" }],
};

/**
 * OpenAI strict JSON schema. additionalProperties must be false; every key required.
 */
export const TRADING_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    decision: {
      type: "string",
      enum: ["BUY_SETUP", "SHORT_SETUP", "WATCHLIST", "NO_TRADE"],
    },
    confidence: { type: "number" },
    summary: { type: "string" },
    thesis: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    uncertainties: { type: "array", items: { type: "string" } },
    supportingSignals: { type: "array", items: { type: "string" } },
    contradictingSignals: { type: "array", items: { type: "string" } },
    newsImpact: {
      type: "string",
      enum: ["POSITIVE", "NEUTRAL", "NEGATIVE", "MIXED", "UNKNOWN"],
    },
    timeHorizon: {
      type: "string",
      enum: ["INTRADAY", "SWING", "UNKNOWN"],
    },
    setupReference: {
      type: "object",
      additionalProperties: false,
      properties: {
        entry: nullableNumberJson,
        stopLoss: nullableNumberJson,
        takeProfit: nullableNumberJson,
        riskReward: nullableNumberJson,
        positionSize: nullableNumberJson,
      },
      required: ["entry", "stopLoss", "takeProfit", "riskReward", "positionSize"],
    },
    usedNewsIds: { type: "array", items: { type: "string" } },
  },
  required: [
    "decision",
    "confidence",
    "summary",
    "thesis",
    "risks",
    "uncertainties",
    "supportingSignals",
    "contradictingSignals",
    "newsImpact",
    "timeHorizon",
    "setupReference",
    "usedNewsIds",
  ],
} as const;
