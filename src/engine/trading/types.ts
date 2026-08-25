export const SETUP_DIRECTIONS = ["LONG", "SHORT", "NO_TRADE"] as const;
export type SetupDirection = (typeof SETUP_DIRECTIONS)[number];

export const SETUP_STATUSES = ["VALID", "INVALID", "REJECTED"] as const;
export type SetupStatus = (typeof SETUP_STATUSES)[number];

export const REJECT_REASONS = [
  "INSUFFICIENT_DATA",
  "STALE_DATA",
  "MOCK_DATA",
  "INVALID_RISK",
  "INVALID_ENTRY",
  "INVALID_STOP",
  "INVALID_TARGET",
  "INVALID_RR",
  "POSITION_SIZE_ZERO",
  "RISK_LIMIT_EXCEEDED",
  "NO_TECHNICAL_EDGE",
  "NO_TRADE",
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

/**
 * User risk inputs as stored in the database (fractions, not UI percents).
 * accountCapital ← user_settings.capital
 * maxRiskPercent ← user_settings.risk_per_trade (e.g. 0.01 = 1%)
 * maxPositionPercent ← user_settings.max_portfolio_exposure (e.g. 0.20 = 20%)
 * minimumRiskReward ← user_settings.minimum_risk_reward
 */
export type TradingRiskSettings = {
  accountCapital: number;
  maxRiskPercent: number;
  maxPositionPercent: number;
  minimumRiskReward: number;
};

export type TradingSetup = {
  symbol: string;
  timeframe: string;
  direction: SetupDirection;
  status: SetupStatus;
  score: number | null;
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskPerUnit: number | null;
  rewardPerUnit: number | null;
  riskReward: number | null;
  accountCapital: number;
  riskPercent: number;
  riskAmount: number | null;
  positionSize: number | null;
  positionValue: number | null;
  actualRisk: number | null;
  dataStatus: string;
  reasons: string[];
  rejectReasons: RejectReason[];
  createdAt: Date;
};

export const REJECT_REASON_LABELS: Record<RejectReason, string> = {
  INSUFFICIENT_DATA: "Insufficient market data",
  STALE_DATA: "Market data is stale",
  MOCK_DATA: "Mock data cannot be used as a live trading setup",
  INVALID_RISK: "Risk parameters are invalid",
  INVALID_ENTRY: "Entry is invalid",
  INVALID_STOP: "Stop loss is invalid",
  INVALID_TARGET: "Take profit is invalid",
  INVALID_RR: "Risk/reward is below the minimum",
  POSITION_SIZE_ZERO: "Position size is zero",
  RISK_LIMIT_EXCEEDED: "Position would exceed the maximum risk",
  NO_TECHNICAL_EDGE: "No technical edge",
  NO_TRADE: "No trade",
};
