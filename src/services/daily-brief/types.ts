import type { BriefStatus } from "@/types/enums";
import type { AnalysisDecision } from "@/types/enums";
import type { SerializedTechnicalSnapshot } from "@/services/market/serialize";
import type { SerializedTradingSetup } from "@/services/market/serialize";

export const DAILY_BRIEF_PROMPT_VERSION = "daily-brief-v1";
export const DAILY_BRIEF_TIMEFRAME = "1day" as const;
export const DAILY_BRIEF_STALE_AFTER_HOURS = 36;

export const BRIEF_ERROR_CODES = [
  "UNAUTHORIZED",
  "INVALID_DATE",
  "INVALID_INPUT",
  "BRIEF_EXISTS",
  "REQUEST_IN_PROGRESS",
  "DATA_UNAVAILABLE",
  "AI_UNAVAILABLE",
  "AI_TIMEOUT",
  "AI_ANALYSIS_INVALID",
  "PERSISTENCE_FAILED",
] as const;
export type BriefErrorCode = (typeof BRIEF_ERROR_CODES)[number];

export type BriefDataStatus =
  | "LIVE"
  | "CACHED"
  | "STALE"
  | "MIXED"
  | "UNAVAILABLE"
  | "MOCK";

export type BriefAiStatus =
  | "ok"
  | "AI_UNAVAILABLE"
  | "AI_TIMEOUT"
  | "AI_ANALYSIS_INVALID"
  | "SKIPPED";

export type BriefMarketItem = {
  symbol: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  dataStatus: string;
  asOf: string | null;
  source: string | null;
};

export type BriefTechnicalItem = {
  symbol: string;
  timeframe: string;
  trend: string;
  momentum: string;
  volatility: string;
  technicalCondition: string;
  dataStatus: string;
  asOf: string | null;
  snapshot: SerializedTechnicalSnapshot | null;
};

export type BriefSetupItem = {
  symbol: string;
  direction: SerializedTradingSetup["direction"];
  status: SerializedTradingSetup["status"];
  score: number | null;
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward: number | null;
  positionSize: number | null;
  riskAmount: number | null;
  reasons: string[];
  rejectReasons: string[];
  dataStatus: string;
};

export type BriefNewsItem = {
  id: string;
  title: string;
  summary: string | null;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  category: string;
  relevance: string;
  sentiment: string;
  assetSymbols: string[];
};

export type BriefAiItem = {
  id: string | null;
  symbol: string;
  decision: AnalysisDecision | string;
  confidence: number | null;
  summary: string | null;
  analyzedAt: string | null;
  setupReference: {
    entry: number | null;
    stopLoss: number | null;
    takeProfit: number | null;
    riskReward: number | null;
    positionSize: number | null;
  } | null;
};

export type BriefOpportunityItem = {
  symbol: string;
  direction: "LONG" | "SHORT";
  status: "VALID";
  score: number | null;
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward: number | null;
  positionSize: number | null;
  riskAmount: number | null;
  reasons: string[];
};

export type BriefWatchItem = {
  symbol: string;
  reason: string;
  direction: string;
  status: string;
  score: number | null;
};

export type BriefNoTradeItem = {
  symbol: string;
  reasons: string[];
  rejectReasons: string[];
  dataStatus: string;
};

export type BriefMacroItem = {
  id: string;
  eventName: string;
  country: string | null;
  importance: string | null;
  scheduledAt: string;
  source: string | null;
};

export type DailyBriefRecord = {
  id: string;
  userId: string;
  briefDate: string;
  timezone: string;
  marketRegime: string | null;
  riskEnvironment: string | null;
  summary: string;
  finalStatus: BriefStatus;
  marketOverview: BriefMarketItem[];
  technicalConditions: BriefTechnicalItem[];
  tradingSetups: BriefSetupItem[];
  importantNews: BriefNewsItem[];
  macroEvents: BriefMacroItem[];
  aiAnalyses: BriefAiItem[];
  topOpportunities: BriefOpportunityItem[];
  watchlist: BriefWatchItem[];
  noTradeAssets: BriefNoTradeItem[];
  risks: string[];
  dataStatus: BriefDataStatus;
  aiStatus: BriefAiStatus;
  model: string | null;
  promptVersion: string | null;
  isMock: boolean;
  generatedAt: string;
  createdAt: string;
  isStale: boolean;
};

export type DailyBriefInputSnapshot = {
  briefDate: string;
  timezone: string;
  timeframe: string;
  generatedAt: string;
  symbols: string[];
  marketOverview: BriefMarketItem[];
  technicalConditions: BriefTechnicalItem[];
  tradingSetups: BriefSetupItem[];
  importantNews: BriefNewsItem[];
  macroEvents: BriefMacroItem[];
  aiAnalyses: BriefAiItem[];
  topOpportunities: BriefOpportunityItem[];
  watchlist: BriefWatchItem[];
  noTradeAssets: BriefNoTradeItem[];
  risks: string[];
  dataStatus: BriefDataStatus;
  newsStatus: string;
  aiStatus: BriefAiStatus;
  model: string | null;
  promptVersion: string | null;
};

export type GenerateBriefSuccess = {
  ok: true;
  brief: DailyBriefRecord;
};

export type GenerateBriefFailure = {
  ok: false;
  code: BriefErrorCode;
  error: string;
};

export type GenerateBriefResult = GenerateBriefSuccess | GenerateBriefFailure;
