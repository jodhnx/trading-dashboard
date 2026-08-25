import type { DataStatus } from "@/services/market/provider";
import type { Timeframe } from "@/types/enums";
import type { PriceLevel } from "../indicators/support-resistance";
import type { VolumeTrend } from "../indicators/volume";
import type { EngineErrorCode } from "../utils/validation";

export const TRENDS = ["BULLISH", "BEARISH", "NEUTRAL", "UNKNOWN"] as const;
export type Trend = (typeof TRENDS)[number];

export const MOMENTUMS = [
  "STRONG",
  "POSITIVE",
  "NEUTRAL",
  "NEGATIVE",
  "WEAK",
  "UNKNOWN",
] as const;
export type Momentum = (typeof MOMENTUMS)[number];

export const VOLATILITIES = ["LOW", "NORMAL", "HIGH", "UNKNOWN"] as const;
export type Volatility = (typeof VOLATILITIES)[number];

export const TECHNICAL_CONDITIONS = [
  "FAVORABLE",
  "MIXED",
  "UNFAVORABLE",
  "UNKNOWN",
] as const;
export type TechnicalCondition = (typeof TECHNICAL_CONDITIONS)[number];

export type TechnicalSnapshot = {
  symbol: string;
  timeframe: Timeframe;
  asOf: Date | null;
  currentPrice: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
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
  volumeTrend: VolumeTrend;
  supportLevels: PriceLevel[];
  resistanceLevels: PriceLevel[];
  trend: Trend;
  momentum: Momentum;
  volatility: Volatility;
  technicalCondition: TechnicalCondition;
  dataStatus: DataStatus;
  dataError: EngineErrorCode | null;
};

export function emptyTechnicalSnapshot(
  symbol: string,
  timeframe: Timeframe,
  dataStatus: DataStatus = "UNAVAILABLE",
  dataError: EngineErrorCode | null = "DATA_UNAVAILABLE",
): TechnicalSnapshot {
  return {
    symbol,
    timeframe,
    asOf: null,
    currentPrice: null,
    previousClose: null,
    change: null,
    changePercent: null,
    high: null,
    low: null,
    volume: null,
    ema20: null,
    ema50: null,
    ema200: null,
    rsi14: null,
    macd: null,
    macdSignal: null,
    macdHistogram: null,
    atr14: null,
    currentVolume: null,
    averageVolume20: null,
    volumeRatio: null,
    volumeTrend: "UNKNOWN",
    supportLevels: [],
    resistanceLevels: [],
    trend: "UNKNOWN",
    momentum: "UNKNOWN",
    volatility: "UNKNOWN",
    technicalCondition: "UNKNOWN",
    dataStatus,
    dataError,
  };
}
