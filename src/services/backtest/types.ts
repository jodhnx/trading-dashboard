import type { DataStatus } from "@/services/market/provider";
import type { PositionSide, Timeframe } from "@/types/enums";

export type BacktestExitReason =
  | "STOP_LOSS"
  | "TAKE_PROFIT"
  | "END_OF_DATA";

export type BacktestConfig = {
  symbol: string;
  timeframe: Timeframe;
  from: Date;
  to: Date;
  startingCapital: number;
};

export type BacktestTrade = {
  id: string;
  side: PositionSide;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  riskAmount: number;
  realizedPnL: number;
  realizedPnLPercent: number | null;
  exitReason: BacktestExitReason;
  setupScore: number | null;
  technicalCondition: string;
  dataStatus: DataStatus;
  decisionTime: string;
};

export type EquityPoint = {
  timestamp: string;
  cash: number;
  invested: number;
  equity: number;
  unrealizedPnL: number;
  drawdown: number;
};

export type BacktestResult = {
  symbol: string;
  timeframe: Timeframe;
  from: string;
  to: string;
  startingCapital: number;
  endingCapital: number;
  totalReturn: number;
  totalPnL: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number | null;
  averageTradePnL: number | null;
  maxDrawdown: number;
  profitFactor: number | null;
  averageRiskReward: number | null;
  dataStatus: DataStatus;
  feesSlippageModeled: false;
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
};

export type BacktestErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_INPUT"
  | "ASSET_NOT_FOUND"
  | "RANGE_TOO_LARGE"
  | "INVALID_DATA"
  | "INSUFFICIENT_DATA"
  | "DATA_UNAVAILABLE";

export type BacktestRiskSettingsView = {
  riskPerTradePercent: number;
  maxPositionPercent: number;
  minimumRiskReward: number;
};

export type BacktestWorkspaceSnapshot = {
  riskSettings: BacktestRiskSettingsView;
};
