export const ASSET_TYPES = [
  "STOCK",
  "ETF",
  "CRYPTO",
  "INDEX",
  "COMMODITY",
  "FOREX",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const TRADING_STYLES = ["SCALP", "DAY", "SWING", "POSITION"] as const;
export type TradingStyle = (typeof TRADING_STYLES)[number];

export const AI_DECISIONS = [
  "BUY_SETUP",
  "SHORT_SETUP",
  "WATCHLIST",
  "WATCH",
  "HOLD",
  "REDUCE",
  "EXIT",
  "NO_TRADE",
] as const;
export type AiDecision = (typeof AI_DECISIONS)[number];

export const ANALYSIS_DECISIONS = [
  "BUY_SETUP",
  "SHORT_SETUP",
  "WATCHLIST",
  "NO_TRADE",
] as const;
export type AnalysisDecision = (typeof ANALYSIS_DECISIONS)[number];

export const BRIEF_STATUSES = ["TRADE", "WATCH", "NO_TRADE"] as const;
export type BriefStatus = (typeof BRIEF_STATUSES)[number];

export const OPPORTUNITY_STATUSES = [
  "NEW",
  "VALID",
  "INVALID",
  "REJECTED",
  "TAKEN",
  "EXPIRED",
  "CLOSED",
] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const POSITION_SIDES = ["LONG", "SHORT"] as const;
export type PositionSide = (typeof POSITION_SIDES)[number];

export const POSITION_STATUSES = ["OPEN", "CLOSED", "CANCELLED"] as const;
export type PositionStatus = (typeof POSITION_STATUSES)[number];

export const BACKTEST_STATUSES = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
] as const;
export type BacktestStatus = (typeof BACKTEST_STATUSES)[number];

export const NEWS_CATEGORIES = [
  "EARNINGS",
  "GUIDANCE",
  "REVENUE",
  "PRODUCT",
  "AI",
  "PARTNERSHIP",
  "ACQUISITION",
  "MERGER",
  "REGULATION",
  "LEGAL",
  "MACRO",
  "INTEREST_RATES",
  "RATES",
  "INFLATION",
  "ETF",
  "CRYPTO_ETF",
  "TOKEN_UNLOCK",
  "NETWORK_UPGRADE",
  "SECURITY",
  "HACK",
  "EXCHANGE",
  "ADOPTION",
  "INSIDER",
  "ANALYST",
  "UPGRADE",
  "DOWNGRADE",
  "BREAKOUT_CATALYST",
  "COMPANY",
  "CRYPTO",
  "GEOPOLITICAL",
  "MARKET",
  "OTHER",
] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const RESEARCH_STATUSES = [
  "NEW",
  "REVIEWED",
  "ARCHIVED",
  "INVALID",
] as const;
export type ResearchStatus = (typeof RESEARCH_STATUSES)[number];

export const SENTIMENTS = [
  "POSITIVE",
  "NEGATIVE",
  "NEUTRAL",
  "MIXED",
  "UNKNOWN",
] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const IMPACT_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type ImpactLevel = (typeof IMPACT_LEVELS)[number];

export const INFORMATION_TYPES = ["FACT", "AI_INTERPRETATION"] as const;
export type InformationType = (typeof INFORMATION_TYPES)[number];

export const PREDICTION_OUTCOMES = [
  "PENDING",
  "WIN",
  "LOSS",
  "BREAKEVEN",
  "EXPIRED",
  "UNKNOWN",
] as const;
export type PredictionOutcome = (typeof PREDICTION_OUTCOMES)[number];

export const TIMEFRAMES = [
  "1min",
  "5min",
  "15min",
  "30min",
  "1h",
  "4h",
  "1day",
  "1week",
] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];
