/**
 * Central classification and structure thresholds.
 * Indicator math (EMA/RSI/MACD/ATR periods) lives next to those functions.
 * Do not duplicate these numbers in UI or API layers.
 */
export const VOLATILITY_THRESHOLDS = {
  /** ATR / price below this → LOW */
  lowMax: 0.01,
  /** ATR / price above this → HIGH */
  highMin: 0.03,
} as const;

export const VOLUME_THRESHOLDS = {
  averagePeriod: 20,
  trendWindow: 5,
  /** |recentAvg - priorAvg| / priorAvg above this → INCREASING or DECREASING */
  trendRelative: 0.1,
} as const;

export const SUPPORT_RESISTANCE_THRESHOLDS = {
  minCandles: 20,
  swingLookback: 2,
  clusterPct: 0.005,
  maxLevels: 5,
} as const;

export const TREND_THRESHOLDS = {
  /** Unused numerically — trend is boolean EMA alignment. Kept for documentation. */
  requireEma200: false,
} as const;

export const MOMENTUM_THRESHOLDS = {
  rsiStrong: 70,
  rsiWeak: 30,
  rsiPositive: 50,
  rsiNegative: 50,
} as const;
