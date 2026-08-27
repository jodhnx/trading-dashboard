import "server-only";

import { z } from "zod";
import type { OpenAiClient } from "@/ai/types";
import type { RankedOpportunity } from "./types";
import {
  AI_RESEARCH_ACTIONS,
  mockResearch,
  selectAiResearchTargets,
  type AiResearchResult,
} from "./ai-research-shared";

export {
  AI_RESEARCH_ACTIONS,
  mockResearch,
  selectAiResearchTargets,
  aiResearchUsesVerifiedDataOnly,
  type AiResearchAction,
  type AiResearchResult,
} from "./ai-research-shared";

const aiResearchOutputSchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  bullCase: z.string().trim().min(1).max(1500),
  bearCase: z.string().trim().min(1).max(1500),
  keyCatalyst: z.string().trim().max(500).nullable(),
  mainRisk: z.string().trim().min(1).max(1000),
  technicalInterpretation: z.string().trim().min(1).max(1500),
  newsInterpretation: z.string().trim().min(1).max(1500),
  whyRanked: z.string().trim().min(1).max(1000),
  whatWouldInvalidate: z.string().trim().min(1).max(1000),
  researchConfidence: z.number().finite().min(0).max(100),
  action: z.enum(AI_RESEARCH_ACTIONS),
});

const AI_RESEARCH_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    bullCase: { type: "string" },
    bearCase: { type: "string" },
    keyCatalyst: { anyOf: [{ type: "string" }, { type: "null" }] },
    mainRisk: { type: "string" },
    technicalInterpretation: { type: "string" },
    newsInterpretation: { type: "string" },
    whyRanked: { type: "string" },
    whatWouldInvalidate: { type: "string" },
    researchConfidence: { type: "number" },
    action: {
      type: "string",
      enum: [...AI_RESEARCH_ACTIONS],
    },
  },
  required: [
    "summary",
    "bullCase",
    "bearCase",
    "keyCatalyst",
    "mainRisk",
    "technicalInterpretation",
    "newsInterpretation",
    "whyRanked",
    "whatWouldInvalidate",
    "researchConfidence",
    "action",
  ],
};

const SYSTEM_PROMPT = `You are a market research assistant for a trading dashboard.
Interpret ONLY the structured JSON input provided. Never invent prices, news, earnings, or indicators.
The deterministic trading engine is the source of truth for technical validity.
Allowed actions: ENTER_IN_ENTRY_ZONE, WAIT_FOR_ENTRY, WAIT_FOR_CONFIRMATION, AVOID, RESEARCH_MORE.
Do not guarantee profits or claim certainty about future price direction.`;

function buildResearchPayload(candidate: RankedOpportunity) {
  return {
    symbol: candidate.symbol,
    assetType: candidate.assetClass,
    currentPrice: candidate.currentPrice,
    priceTimestamp: candidate.marketUpdatedAt ?? candidate.scannedAt,
    dataFreshness: candidate.dataFreshness,
    trend: candidate.confirmation?.trend ?? "UNKNOWN",
    momentum: candidate.confirmation?.momentum ?? "UNKNOWN",
    ema: candidate.confirmation?.ema ?? "UNKNOWN",
    macd: candidate.confirmation?.macd ?? "UNKNOWN",
    atr14: candidate.atr14,
    volumeNote:
      candidate.scores.volumeScore >= 60 ? "elevated" : "normal_or_unknown",
    opportunityScore: candidate.scores.opportunityScore,
    riskReward: candidate.riskReward,
    marketRegime: candidate.marketRegime,
    discoveryReasons: candidate.discoveryTags ?? [],
    tradeStatus: candidate.tradeStatus,
    quality: candidate.quality,
    technicalConfirmation: candidate.technicalConfirmation,
    relevantNews: candidate.newsItems.slice(0, 5).map((item) => ({
      headline: item.title,
      source: item.source,
      publishedAt: item.publishedAt,
      sentiment: item.sentiment,
      category: item.category,
      impact: item.impactScore,
      relevance: item.relevance,
    })),
    newsSentiment: candidate.scores.sentimentScore,
    newsRecency: candidate.newsUpdatedAt,
    newsCategories: [...new Set(candidate.newsItems.map((n) => n.category))],
    engineDirection: candidate.direction,
    engineStatus: candidate.confirmation?.confirmation ?? candidate.technicalConfirmation,
  };
}

export async function analyzeCandidateResearch(input: {
  candidate: RankedOpportunity;
  client: OpenAiClient;
  now?: Date;
}): Promise<AiResearchResult> {
  const now = input.now ?? new Date();
  const payload = buildResearchPayload(input.candidate);

  if (input.client.isMock) {
    return mockResearch(input.candidate, now);
  }

  try {
    const completion = await input.client.completeStructured({
      system: SYSTEM_PROMPT,
      user: `Interpret this verified candidate data and return structured research JSON only:\n${JSON.stringify(payload, null, 2)}`,
      schemaName: "opportunity_research",
      schema: AI_RESEARCH_JSON_SCHEMA as unknown as Record<string, unknown>,
    });

    if (completion.status !== "ok") {
      return unavailableResearch(now, completion.detail ?? completion.status);
    }

    const parsed = aiResearchOutputSchema.safeParse(completion.value);
    if (!parsed.success) {
      return unavailableResearch(now, "invalid_ai_output");
    }

    return {
      ...parsed.data,
      analyzedAt: now.toISOString(),
    };
  } catch (error) {
    return unavailableResearch(
      now,
      error instanceof Error ? error.message : "ai_error",
    );
  }
}

export async function runAiResearchForCandidates(input: {
  candidates: RankedOpportunity[];
  client: OpenAiClient | null;
  now?: Date;
  limit?: number;
}): Promise<{ updated: RankedOpportunity[]; completed: number; failed: number }> {
  if (!input.client) {
    return { updated: input.candidates, completed: 0, failed: 0 };
  }

  const targets = selectAiResearchTargets(input.candidates, input.limit ?? 12);
  const bySymbol = new Map(input.candidates.map((item) => [item.symbol, item]));
  let completed = 0;
  let failed = 0;

  for (const target of targets) {
    const research = await analyzeCandidateResearch({
      candidate: target,
      client: input.client,
      now: input.now,
    });
    if (research.unavailable) {
      failed += 1;
      continue;
    }
    completed += 1;
    bySymbol.set(target.symbol, {
      ...target,
      aiResearch: research,
      aiAnalyzedAt: research.analyzedAt,
    });
  }

  return {
    updated: input.candidates.map((item) => bySymbol.get(item.symbol) ?? item),
    completed,
    failed,
  };
}

function unavailableResearch(now: Date, error: string): AiResearchResult {
  return {
    summary: "AI research unavailable for this candidate.",
    bullCase: "Not generated — AI unavailable.",
    bearCase: "Not generated — AI unavailable.",
    keyCatalyst: null,
    mainRisk: "AI research layer did not run.",
    technicalInterpretation: "Use deterministic engine output only.",
    newsInterpretation: "Use stored news items only.",
    whyRanked: "Ranking based on deterministic scan scores.",
    whatWouldInvalidate: "Unavailable — AI did not run.",
    researchConfidence: 0,
    action: "RESEARCH_MORE",
    analyzedAt: now.toISOString(),
    unavailable: true,
    error,
  };
}
