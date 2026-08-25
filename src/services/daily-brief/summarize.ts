import type { OpenAiClient } from "@/ai/types";
import {
  DAILY_BRIEF_SUMMARY_JSON_SCHEMA,
  dailyBriefSummarySchema,
} from "@/ai/schemas/daily-brief-summary";
import {
  DAILY_BRIEF_SUMMARY_PROMPT_VERSION,
  DAILY_BRIEF_SUMMARY_SYSTEM_PROMPT,
  dailyBriefSummaryUserPrompt,
} from "@/ai/prompts/daily-brief-summary";
import type { AssembledBrief } from "./assemble";
import type { BriefAiStatus, DailyBriefInputSnapshot } from "./types";

export type BriefSummaryResult = {
  summary: string;
  marketRegime: string;
  riskEnvironment: string;
  risks: string[];
  aiStatus: BriefAiStatus;
  model: string | null;
  promptVersion: string;
  notes: string[];
};

function summaryPayload(assembled: AssembledBrief): Record<string, unknown> {
  const snap = assembled.snapshot;
  return {
    briefDate: snap.briefDate,
    finalStatus: assembled.finalStatus,
    marketRegime: assembled.marketRegime,
    riskEnvironment: assembled.riskEnvironment,
    dataStatus: snap.dataStatus,
    newsStatus: snap.newsStatus,
    topOpportunities: snap.topOpportunities,
    watchlist: snap.watchlist,
    noTradeAssets: snap.noTradeAssets,
    tradingSetups: snap.tradingSetups.map((setup) => ({
      symbol: setup.symbol,
      direction: setup.direction,
      status: setup.status,
      score: setup.score,
      entry: setup.entry,
      stopLoss: setup.stopLoss,
      takeProfit: setup.takeProfit,
      riskReward: setup.riskReward,
      positionSize: setup.positionSize,
      reasons: setup.reasons,
      rejectReasons: setup.rejectReasons,
      dataStatus: setup.dataStatus,
    })),
    technicalConditions: snap.technicalConditions.map((item) => ({
      symbol: item.symbol,
      trend: item.trend,
      momentum: item.momentum,
      volatility: item.volatility,
      technicalCondition: item.technicalCondition,
      dataStatus: item.dataStatus,
    })),
    marketOverview: snap.marketOverview,
    importantNews: snap.importantNews.map((item) => ({
      id: item.id,
      title: item.title,
      sourceName: item.sourceName,
      publishedAt: item.publishedAt,
      category: item.category,
      sentiment: item.sentiment,
    })),
    macroEvents: snap.macroEvents,
    aiAnalyses: snap.aiAnalyses,
    risks: snap.risks,
    deterministicSummary: assembled.summary,
  };
}

/**
 * OpenAI may explain the assembled brief. It must not invent or rewrite
 * Trading Engine numbers. On AI failure, keep the deterministic summary.
 */
export async function summarizeDailyBrief(input: {
  assembled: AssembledBrief;
  client: OpenAiClient | null;
}): Promise<BriefSummaryResult> {
  const base: BriefSummaryResult = {
    summary: input.assembled.summary,
    marketRegime: input.assembled.marketRegime,
    riskEnvironment: input.assembled.riskEnvironment,
    risks: input.assembled.snapshot.risks,
    aiStatus: "SKIPPED",
    model: null,
    promptVersion: DAILY_BRIEF_SUMMARY_PROMPT_VERSION,
    notes: [],
  };

  if (!input.client) {
    return { ...base, aiStatus: "AI_UNAVAILABLE" };
  }

  const completion = await input.client.completeStructured({
    system: DAILY_BRIEF_SUMMARY_SYSTEM_PROMPT,
    user: dailyBriefSummaryUserPrompt(summaryPayload(input.assembled)),
    schemaName: "daily_brief_summary",
    schema: DAILY_BRIEF_SUMMARY_JSON_SCHEMA as unknown as Record<string, unknown>,
  });

  if (completion.status !== "ok") {
    return {
      ...base,
      aiStatus: completion.status,
      model: input.client.model,
    };
  }

  const parsed = dailyBriefSummarySchema.safeParse(completion.value);
  if (!parsed.success) {
    return {
      ...base,
      aiStatus: "AI_ANALYSIS_INVALID",
      model: input.client.model,
    };
  }

  // Engine classifications stay authoritative; AI may enrich wording only.
  return {
    summary: parsed.data.summary,
    marketRegime: input.assembled.marketRegime,
    riskEnvironment: input.assembled.riskEnvironment,
    risks: [...new Set([...input.assembled.snapshot.risks, ...parsed.data.risks])],
    aiStatus: "ok",
    model: input.client.model,
    promptVersion: DAILY_BRIEF_SUMMARY_PROMPT_VERSION,
    notes: parsed.data.notes,
  };
}

export function applySummaryToSnapshot(
  snapshot: DailyBriefInputSnapshot,
  summary: BriefSummaryResult,
): DailyBriefInputSnapshot {
  return {
    ...snapshot,
    risks: summary.risks,
    aiStatus: summary.aiStatus,
    model: summary.model,
    promptVersion: summary.promptVersion,
  };
}
