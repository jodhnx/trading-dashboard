import type { DataStatus } from "@/services/market/provider";

export type PortfolioHoldingInput = {
  symbol: string;
  quantity: number;
  averageEntryPrice: number;
};

export type PortfolioHoldingPatch = {
  quantity?: number;
  averageEntryPrice?: number;
};

export type StoredHolding = {
  id: string;
  portfolioId: string;
  userId: string;
  assetId: string;
  symbol: string;
  quantity: number;
  averageEntryPrice: number;
  createdAt: string;
  updatedAt: string;
};

export type ValuedHolding = {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  averageEntryPrice: number;
  investedValue: number;
  currentPrice: number | null;
  marketValue: number | null;
  unrealizedPnL: number | null;
  unrealizedPnLPercent: number | null;
  allocationPercent: number | null;
  dataStatus: DataStatus | "DATA_UNAVAILABLE";
  asOf: string | null;
  source: string | null;
};

export type AllocationRow = {
  key: string;
  label: string;
  allocationPercent: number | null;
  value: number | null;
};

export type PortfolioSnapshot = {
  portfolioId: string;
  currency: string;
  cash: number;
  holdings: ValuedHolding[];
  totalInvested: number;
  totalMarketValue: number | null;
  totalPortfolioValue: number | null;
  unrealizedPnL: number | null;
  realizedPnL: number | null;
  allocation: AllocationRow[];
  dataStatus: DataStatus | "MIXED" | "DATA_UNAVAILABLE";
  updatedAt: string;
};

export const PORTFOLIO_ERROR_CODES = [
  "UNAUTHORIZED",
  "INVALID_INPUT",
  "NOT_FOUND",
  "DUPLICATE_HOLDING",
  "DATA_UNAVAILABLE",
] as const;
export type PortfolioErrorCode = (typeof PORTFOLIO_ERROR_CODES)[number];
