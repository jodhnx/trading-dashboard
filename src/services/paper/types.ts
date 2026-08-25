import type { DataStatus } from "@/services/market/provider";
import type { PositionSide } from "@/types/enums";
import type { PaperCloseReason } from "@/types/database";

export const PAPER_ERROR_CODES = [
  "UNAUTHORIZED",
  "INVALID_INPUT",
  "INVALID_TRADING_SETUP",
  "DUPLICATE_OPEN_POSITION",
  "INSUFFICIENT_CASH",
  "NOT_FOUND",
  "CONFLICT",
  "DATA_UNAVAILABLE",
] as const;
export type PaperErrorCode = (typeof PAPER_ERROR_CODES)[number];

export type PaperSetupSnapshot = {
  symbol: string;
  timeframe: string;
  direction: PositionSide;
  score: number | null;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number | null;
  riskAmount: number;
  positionSize: number;
  positionValue: number;
  dataStatus: string;
  technicalCondition: string | null;
  createdAt: string;
};

export type ValuedPaperPosition = {
  id: string;
  symbol: string;
  name: string;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  currentPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  marketValue: number | null;
  unrealizedPnL: number | null;
  unrealizedPnLPercent: number | null;
  dataStatus: DataStatus | "DATA_UNAVAILABLE";
  openedAt: string;
};

export type PaperTradeRecord = {
  id: string;
  symbol: string;
  name: string;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  realizedPnL: number | null;
  realizedPnLPercent: number | null;
  closeReason: PaperCloseReason | null;
  status: "OPEN" | "CLOSED";
  setupScore: number | null;
  openedAt: string;
  closedAt: string | null;
};

export type PaperAccountSnapshot = {
  accountId: string;
  startingBalance: number;
  cashBalance: number;
  equity: number | null;
  invested: number | null;
  unrealizedPnL: number | null;
  realizedPnL: number;
  openPositions: ValuedPaperPosition[];
  closedTrades: PaperTradeRecord[];
  dataStatus: DataStatus | "MIXED" | "DATA_UNAVAILABLE";
  updatedAt: string;
};

export type StoredPaperPosition = {
  id: string;
  accountId: string | null;
  userId: string;
  assetId: string;
  symbol: string;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  openedAt: string;
  updatedAt: string;
};

export type StoredPaperTrade = {
  id: string;
  userId: string;
  positionId: string | null;
  assetId: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  riskAmount: number | null;
  pnl: number | null;
  pnlPercent: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  setupScore: number | null;
  setupSnapshot: PaperSetupSnapshot | null;
  status: "OPEN" | "CLOSED";
  closeReason: PaperCloseReason | null;
  openedAt: string;
  closedAt: string | null;
};
