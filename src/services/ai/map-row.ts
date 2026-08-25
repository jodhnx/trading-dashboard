import type { AnalysisNewsInput, TradingAnalysisInput, TradingAnalysisRecord } from "@/ai/types";
import { TRADING_ANALYSIS_PROMPT_VERSION } from "@/ai/prompts";
import type { AiAnalysisRow, Json } from "@/types/database";
import { ANALYSIS_DECISIONS, type AnalysisDecision } from "@/types/enums";
import type { NewsImpact, TimeHorizon } from "@/ai/types";

export type AnalysisInsert = {
  userId: string;
  assetId: string;
  record: TradingAnalysisRecord;
  payload: TradingAnalysisInput;
  setupScore: number | null;
};

function asDecision(value: string): AnalysisDecision | null {
  return (ANALYSIS_DECISIONS as readonly string[]).includes(value)
    ? (value as AnalysisDecision)
    : null;
}

function asNewsList(value: unknown): AnalysisNewsInput[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is AnalysisNewsInput => {
    if (typeof item !== "object" || item === null) {
      return false;
    }
    const row = item as Partial<AnalysisNewsInput>;
    return typeof row.id === "string" && typeof row.title === "string";
  });
}

export function toInputSnapshot(
  payload: TradingAnalysisInput,
  record: TradingAnalysisRecord,
  inputFingerprint?: string,
): Json {
  return {
    model: record.model,
    promptVersion: TRADING_ANALYSIS_PROMPT_VERSION,
    analyzedAt: record.analyzedAt,
    symbol: payload.asset,
    timeframe: payload.timeframe,
    inputFingerprint: inputFingerprint ?? null,
    marketData: payload.marketData,
    technicalSnapshot: payload.technicalSnapshot,
    tradingSetup: payload.tradingSetup,
    news: payload.relevantNews.map((item) => ({
      id: item.id,
      title: item.title,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      publishedAt: item.publishedAt,
      freshness: item.freshness,
      category: item.category,
      relevance: item.relevance,
      sentiment: item.sentiment,
    })),
    newsCount: payload.relevantNews.length,
    userRiskSettings: payload.userRiskSettings,
  };
}

export function analysisFromRow(
  row: AiAnalysisRow,
  symbol: string,
): TradingAnalysisRecord | null {
  const decision = asDecision(row.decision);
  if (!decision) {
    return null;
  }
  const snapshot = (row.input_snapshot ?? {}) as {
    news?: unknown;
    marketData?: { dataStatus?: string };
  };
  const news = asNewsList(snapshot.news);
  const ref = (row.setup_reference ?? {}) as TradingAnalysisRecord["setupReference"];
  return {
    id: row.id,
    symbol,
    timeframe: row.timeframe ?? "1day",
    decision,
    confidence: row.confidence,
    summary: row.summary ?? "",
    thesis: row.thesis ?? row.reasons ?? [],
    risks: row.risks ?? [],
    uncertainties: row.uncertainties ?? [],
    supportingSignals: row.supporting_signals ?? [],
    contradictingSignals: row.contradicting_signals ?? [],
    newsImpact: (row.news_impact as NewsImpact | null) ?? "UNKNOWN",
    timeHorizon: (row.time_horizon as TimeHorizon | null) ?? "UNKNOWN",
    setupReference: {
      entry: ref.entry ?? row.entry,
      stopLoss: ref.stopLoss ?? row.stop_loss,
      takeProfit: ref.takeProfit ?? row.take_profit_1,
      riskReward: ref.riskReward ?? row.risk_reward,
      positionSize: ref.positionSize ?? null,
    },
    model: row.model ?? "unknown",
    isMock: row.is_mock,
    analyzedAt: row.created_at,
    dataTimestamp: row.data_timestamp,
    dataStatus: snapshot.marketData?.dataStatus ?? "UNAVAILABLE",
    newsCount: news.length,
    news,
    promptVersion: row.prompt_version ?? TRADING_ANALYSIS_PROMPT_VERSION,
  };
}

export function toInsertRow(
  input: AnalysisInsert,
  inputFingerprint?: string,
): {
  user_id: string;
  asset_id: string;
  analysis_timestamp: string;
  decision: AnalysisDecision;
  score: number;
  confidence: number;
  trend: string | null;
  entry: number | null;
  stop_loss: number | null;
  take_profit_1: number | null;
  take_profit_2: null;
  risk_reward: number | null;
  reasons: string[];
  risks: string[];
  news_impact: string;
  model: string;
  prompt_version: string;
  data_timestamp: string | null;
  summary: string;
  thesis: string[];
  uncertainties: string[];
  supporting_signals: string[];
  contradicting_signals: string[];
  time_horizon: string;
  setup_reference: Json;
  input_snapshot: Json;
  timeframe: string;
  is_mock: boolean;
} {
  const { record, payload, userId, assetId, setupScore } = input;
  const score = setupScore === null ? 0 : Math.min(100, Math.max(0, setupScore));
  return {
    user_id: userId,
    asset_id: assetId,
    analysis_timestamp: record.analyzedAt,
    decision: record.decision,
    score,
    confidence: record.confidence,
    trend: payload.technicalSnapshot.trend,
    entry: record.setupReference.entry,
    stop_loss: record.setupReference.stopLoss,
    take_profit_1: record.setupReference.takeProfit,
    take_profit_2: null,
    risk_reward: record.setupReference.riskReward,
    reasons: record.thesis,
    risks: record.risks,
    news_impact: record.newsImpact,
    model: record.model,
    prompt_version: record.promptVersion,
    data_timestamp: record.dataTimestamp,
    summary: record.summary,
    thesis: record.thesis,
    uncertainties: record.uncertainties,
    supporting_signals: record.supportingSignals,
    contradicting_signals: record.contradictingSignals,
    time_horizon: record.timeHorizon,
    setup_reference: record.setupReference,
    input_snapshot: toInputSnapshot(payload, record, inputFingerprint),
    timeframe: record.timeframe,
    is_mock: record.isMock,
  };
}
