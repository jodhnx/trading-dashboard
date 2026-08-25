import type { AnalysisDecision } from "@/types/enums";
import type { TradingSetup } from "@/engine/trading/types";
import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import type { TradingRiskSettings } from "@/engine/trading/types";

export const ANALYSIS_ERROR_CODES = [
  "AI_UNAVAILABLE",
  "AI_TIMEOUT",
  "AI_ANALYSIS_INVALID",
  "DATA_UNAVAILABLE",
  "STALE_DATA",
  "INVALID_SETUP",
  "REQUEST_IN_PROGRESS",
] as const;
export type AnalysisErrorCode = (typeof ANALYSIS_ERROR_CODES)[number];

export const NEWS_IMPACTS = [
  "POSITIVE",
  "NEUTRAL",
  "NEGATIVE",
  "MIXED",
  "UNKNOWN",
] as const;
export type NewsImpact = (typeof NEWS_IMPACTS)[number];

export const TIME_HORIZONS = ["INTRADAY", "SWING", "UNKNOWN"] as const;
export type TimeHorizon = (typeof TIME_HORIZONS)[number];

export const NEWS_FRESHNESS = ["CURRENT", "RECENT", "OLDER", "STALE"] as const;
export type NewsFreshness = (typeof NEWS_FRESHNESS)[number];

export type AnalysisSetupReference = {
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward: number | null;
  positionSize: number | null;
};

export type AnalysisNewsInput = {
  id: string;
  title: string;
  summary: string | null;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  category: string;
  relevance: string;
  sentiment: string;
  freshness: NewsFreshness;
};

export type AnalysisMarketData = {
  currentPrice: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  dataStatus: string;
  asOf: string | null;
};

export type AnalysisTechnicalInput = {
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  atr14: number | null;
  currentVolume: number | null;
  averageVolume20: number | null;
  volumeRatio: number | null;
  supportLevels: TechnicalSnapshot["supportLevels"];
  resistanceLevels: TechnicalSnapshot["resistanceLevels"];
  trend: TechnicalSnapshot["trend"];
  momentum: TechnicalSnapshot["momentum"];
  volatility: TechnicalSnapshot["volatility"];
  technicalCondition: TechnicalSnapshot["technicalCondition"];
};

export type AnalysisTradingSetupInput = {
  direction: TradingSetup["direction"];
  status: TradingSetup["status"];
  score: number | null;
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskPerUnit: number | null;
  rewardPerUnit: number | null;
  riskReward: number | null;
  riskAmount: number | null;
  positionSize: number | null;
  positionValue: number | null;
  actualRisk: number | null;
  reasons: string[];
  rejectReasons: string[];
  dataStatus: string;
};

export type AnalysisUserRiskSettings = {
  accountCapital: number;
  maxRiskPercent: number;
  maxPositionPercent: number;
  minimumRiskReward: number;
};

export type TradingAnalysisInput = {
  asset: string;
  timeframe: string;
  marketData: AnalysisMarketData;
  technicalSnapshot: AnalysisTechnicalInput;
  tradingSetup: AnalysisTradingSetupInput;
  relevantNews: AnalysisNewsInput[];
  userRiskSettings: AnalysisUserRiskSettings;
};

export type TradingAnalysisOutput = {
  decision: AnalysisDecision;
  confidence: number;
  summary: string;
  thesis: string[];
  risks: string[];
  uncertainties: string[];
  supportingSignals: string[];
  contradictingSignals: string[];
  newsImpact: NewsImpact;
  timeHorizon: TimeHorizon;
  setupReference: AnalysisSetupReference;
  usedNewsIds: string[];
};

export type TradingAnalysisRecord = {
  id: string | null;
  symbol: string;
  timeframe: string;
  decision: AnalysisDecision;
  confidence: number;
  summary: string;
  thesis: string[];
  risks: string[];
  uncertainties: string[];
  supportingSignals: string[];
  contradictingSignals: string[];
  newsImpact: NewsImpact;
  timeHorizon: TimeHorizon;
  setupReference: AnalysisSetupReference;
  model: string;
  isMock: boolean;
  analyzedAt: string;
  dataTimestamp: string | null;
  dataStatus: string;
  newsCount: number;
  news: AnalysisNewsInput[];
  promptVersion: string;
};

export type AnalyzeSuccess = {
  ok: true;
  analysis: TradingAnalysisRecord;
};

export type AnalyzeFailure = {
  ok: false;
  code: AnalysisErrorCode;
  error: string;
};

export type AnalyzeResult = AnalyzeSuccess | AnalyzeFailure;

export type OpenAiCompletionOk = { status: "ok"; value: unknown };
export type OpenAiCompletionErr = {
  status: "AI_TIMEOUT" | "AI_UNAVAILABLE" | "AI_ANALYSIS_INVALID";
  detail?: string;
};
export type OpenAiCompletionResult = OpenAiCompletionOk | OpenAiCompletionErr;

export type OpenAiClient = {
  readonly isMock: boolean;
  readonly model: string;
  completeStructured(input: {
    system: string;
    user: string;
    schemaName: string;
    schema: Record<string, unknown>;
  }): Promise<OpenAiCompletionResult>;
};

export function toSetupReference(setup: TradingSetup): AnalysisSetupReference {
  return {
    entry: setup.entry,
    stopLoss: setup.stopLoss,
    takeProfit: setup.takeProfit,
    riskReward: setup.riskReward,
    positionSize: setup.positionSize,
  };
}

export function toTradingRiskPayload(
  settings: TradingRiskSettings,
): AnalysisUserRiskSettings {
  return {
    accountCapital: settings.accountCapital,
    maxRiskPercent: settings.maxRiskPercent,
    maxPositionPercent: settings.maxPositionPercent,
    minimumRiskReward: settings.minimumRiskReward,
  };
}
