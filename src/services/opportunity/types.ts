import type { DataStatus } from "@/services/market/provider";
import type { SetupDirection } from "@/engine/trading/types";

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

/** Configurable opportunity score weights (normalized). Does not alter Trading Engine SCORE_WEIGHTS. */
export const OPPORTUNITY_SCORE_WEIGHTS = {
  technical: 30,
  momentum: 15,
  volume: 10,
  news: 15,
  catalyst: 10,
  sentiment: 5,
  marketRegime: 5,
  riskReward: 10,
} as const;

export const STRONG_OPPORTUNITY_MIN = 80;
export const OPPORTUNITY_MIN = 65;
export const WATCH_MIN = 50;
export const TOP_STOCK_LIMIT = 5;
export const TOP_CRYPTO_LIMIT = 5;

export type OpportunityScoreBreakdown = {
  technicalScore: number;
  momentumScore: number;
  volumeScore: number;
  newsScore: number;
  catalystScore: number;
  sentimentScore: number;
  marketRegimeScore: number;
  riskRewardScore: number;
  opportunityScore: number;
  weights: typeof OPPORTUNITY_SCORE_WEIGHTS;
};

export type RankedOpportunity = {
  symbol: string;
  name: string;
  assetClass: "STOCK" | "CRYPTO" | "ETF" | "COMMODITY" | "INDEX";
  direction: SetupDirection;
  tier: OpportunityTier;
  setupType: SetupType;
  holdingHorizon: HoldingHorizon;
  currentPrice: number | null;
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
  reasons: string[];
  risks: string[];
  newsHeadlines: string[];
  scannedAt: string;
};

export type OpportunityScanSummary = {
  scanned: number;
  available: number;
  unavailable: number;
  strong: number;
  opportunities: number;
  watch: number;
  noTrade: number;
  topStocks: RankedOpportunity[];
  topCrypto: RankedOpportunity[];
  all: RankedOpportunity[];
  marketRegime: MarketRegime;
  noHighConfidence: boolean;
};
