import type { DataStatus } from "@/services/market/provider";
import type { SetupDirection } from "@/engine/trading/types";
import type { SignalDiagnosticsReport } from "./signal-diagnostics";

export const OPPORTUNITY_TIERS = [
  "STRONG_OPPORTUNITY",
  "OPPORTUNITY",
  "WATCH",
  "NO_TRADE",
] as const;
export type OpportunityTier = (typeof OPPORTUNITY_TIERS)[number];

export const SETUP_TYPES = [
  "BREAKOUT",
  "PULLBACK",
  "MOMENTUM",
  "MEAN_REVERSION",
  "CATALYST",
  "TREND_CONTINUATION",
  "REVERSAL",
  "NO_SETUP",
] as const;
export type SetupType = (typeof SETUP_TYPES)[number];

export const HOLDING_HORIZONS = [
  "INTRADAY",
  "SWING",
  "POSITION",
  "UNKNOWN",
] as const;
export type HoldingHorizon = (typeof HOLDING_HORIZONS)[number];

export const MARKET_REGIMES = [
  "BULL",
  "BEAR",
  "SIDEWAYS",
  "HIGH_VOLATILITY",
  "RISK_ON",
  "RISK_OFF",
  "UNKNOWN",
] as const;
export type MarketRegime = (typeof MARKET_REGIMES)[number];

/**
 * Absolute opportunity score weights (sum = 100).
 * Does not alter Trading Engine SCORE_WEIGHTS.
 *
 * Phase 22 final: multiTimeFrame is 10 points of a literal 100-point scheme.
 * technical is 20 (was 30 pre-MTF) so the sum stays 100 without normalizing 110→100.
 * Canonical key is multiTimeFrame (API); multiTimeframe alias kept in serializers only.
 */
export const OPPORTUNITY_SCORE_WEIGHTS = {
  technical: 20,
  momentum: 15,
  volume: 10,
  news: 15,
  catalyst: 10,
  sentiment: 5,
  marketRegime: 5,
  riskReward: 10,
  multiTimeFrame: 10,
} as const;

/** Runtime guard — weights must always sum to 100. */
export function opportunityScoreWeightsSum(): number {
  return Object.values(OPPORTUNITY_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
}

export const SIGNAL_QUALITIES = [
  "STRONG",
  "CONFIRMED",
  "EARLY_SETUP",
  "WATCH",
  "NO_TRADE",
  "DATA_INSUFFICIENT",
] as const;
export type SignalQuality = (typeof SIGNAL_QUALITIES)[number];

export const DATA_FRESHNESS = [
  "LIVE",
  "RECENT",
  "CACHED",
  "STALE",
  "UNAVAILABLE",
] as const;
export type DataFreshness = (typeof DATA_FRESHNESS)[number];

export type MtfFrameStatus = {
  timeframe: string;
  available: boolean;
  dataStatus: string;
  trend: string;
  momentum: string;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  atr14: number | null;
  timestamp: string | null;
  reason: string | null;
};

export type MtfAlignment = {
  daily: MtfFrameStatus;
  setup: MtfFrameStatus;
  entry: MtfFrameStatus;
  aligned: boolean;
  score: number;
  notes: string[];
};

export const STRONG_OPPORTUNITY_MIN = 80;
export const OPPORTUNITY_MIN = 65;
export const WATCH_MIN = 50;
export const TOP_STOCK_LIMIT = 5;
export const TOP_CRYPTO_LIMIT = 5;

/** Hobby plan: one cron/day — exit monitoring needs a separate scheduler later. */
export const SCHEDULER_NOTE =
  "Vercel Hobby supports one cron job; daily scan covers universe/news/regime/ranking. Real-time exit monitoring needs an external/hourly scheduler — daily data is not real-time.";

/** Board-level outcome — never confuse scanner failure with genuine NO_TRADE. */
export const SCAN_BOARD_STATES = [
  "OPPORTUNITIES_AVAILABLE",
  "WATCH_ONLY",
  "NO_TRADE",
  "DATA_INSUFFICIENT",
] as const;
export type ScanBoardState = (typeof SCAN_BOARD_STATES)[number];

export type OpportunityNewsItem = {
  title: string;
  source: string | null;
  publishedAt: string | null;
  sentiment: string;
  category: string;
  relevance: string;
  impactScore: number;
};

export type OpportunityCandidateDiagnostic = {
  symbol: string;
  assetType: string;
  quoteStatus: string;
  technicalStatus: string;
  engineStatus: string;
  engineDirection: string;
  engineScore: number | null;
  technicalScore: number;
  momentumScore: number;
  volumeScore: number;
  newsScore: number;
  catalystScore: number;
  sentimentScore: number;
  regimeScore: number;
  riskRewardScore: number;
  multiTimeFrameScore: number;
  /** @deprecated use multiTimeFrameScore */
  multiTimeframeScore: number;
  finalOpportunityScore: number;
  tier: OpportunityTier | "DATA_SKIP";
  quality: SignalQuality | "DATA_SKIP";
  tradeStatus?: string;
  blockReason?: string | null;
  technicalConfirmation?: string;
  rejectionReason: string | null;
};

export type OpportunityScoreBreakdown = {
  technicalScore: number;
  momentumScore: number;
  volumeScore: number;
  newsScore: number;
  catalystScore: number;
  sentimentScore: number;
  marketRegimeScore: number;
  riskRewardScore: number;
  multiTimeFrameScore: number;
  /** @deprecated alias of multiTimeFrameScore */
  multiTimeframeScore: number;
  opportunityScore: number;
  weights: typeof OPPORTUNITY_SCORE_WEIGHTS;
};

export type RankedOpportunity = {
  symbol: string;
  name: string;
  assetClass: "STOCK" | "CRYPTO" | "ETF" | "COMMODITY" | "INDEX";
  direction: SetupDirection;
  /** Legacy board tier (persistence / Phase 18–21 compat). */
  tier: OpportunityTier;
  /** Phase 22 explicit signal quality (ELIGIBLE trades / developing / watch). */
  quality: SignalQuality;
  /** Technical confirmation before trade gates: NONE | WATCH | EARLY_SETUP | STRONG */
  technicalConfirmation: string;
  tradeStatus: "ELIGIBLE" | "BLOCKED" | "NO_TRADE";
  blockReason: string | null;
  setupType: SetupType;
  holdingHorizon: HoldingHorizon;
  currentPrice: number | null;
  atr14: number | null;
  engineScore: number | null;
  entry: number | null;
  entryZoneLow: number | null;
  entryZoneHigh: number | null;
  maxChase: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  invalidation: number | null;
  riskReward: number | null;
  positionSize: number | null;
  riskAmount: number | null;
  scores: OpportunityScoreBreakdown;
  marketRegime: MarketRegime;
  dataStatus: DataStatus | "UNAVAILABLE";
  dataFreshness: DataFreshness;
  confidence: number;
  thesis: string;
  mtf: MtfAlignment;
  reasons: string[];
  risks: string[];
  waitingFor: string[];
  newsHeadlines: string[];
  newsItems: OpportunityNewsItem[];
  confirmation: {
    direction: string;
    confirmation: string;
    trend: string;
    momentum: string;
    ema: string;
    macd: string;
    regime: string;
    atrValid: boolean;
    rrValid: boolean | null;
    explain: string;
  } | null;
  scannedAt: string;
};

export type FreshnessCounts = {
  liveCount: number;
  recentCount: number;
  cachedCount: number;
  staleCount: number;
  unavailableCount: number;
  dataSkippedCount: number;
  skipReasons: Record<string, number>;
};

export type OpportunityScanSummary = {
  scanned: number;
  available: number;
  unavailable: number;
  liveOrCached: number;
  strong: number;
  opportunities: number;
  confirmed: number;
  earlySetup: number;
  watch: number;
  noTrade: number;
  bestStock: RankedOpportunity | null;
  bestCrypto: RankedOpportunity | null;
  topStocks: RankedOpportunity[];
  topCrypto: RankedOpportunity[];
  developing: RankedOpportunity[];
  watchList: RankedOpportunity[];
  all: RankedOpportunity[];
  marketRegime: MarketRegime;
  noHighConfidence: boolean;
  whyNoBestStock: string | null;
  whyNoBestCrypto: string | null;
  boardState: ScanBoardState;
  freshness: FreshnessCounts;
  diagnostics: OpportunityCandidateDiagnostic[];
  signalReport: SignalDiagnosticsReport;
  schedulerNote: string;
};
