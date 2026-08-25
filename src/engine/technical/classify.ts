import { MOMENTUM_THRESHOLDS, VOLATILITY_THRESHOLDS } from "./thresholds";
import type { Momentum, TechnicalCondition, Trend, Volatility } from "./technical-snapshot";

/**
 * Trend from price vs EMA alignment. Not a buy/sell signal.
 *
 * UNKNOWN: currentPrice, ema20, or ema50 is null
 * BULLISH: price > ema20 AND ema20 > ema50 AND (ema200 is null OR ema50 > ema200)
 * BEARISH: price < ema20 AND ema20 < ema50 AND (ema200 is null OR ema50 < ema200)
 * NEUTRAL: otherwise
 */
export function classifyTrend(input: {
  currentPrice: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
}): Trend {
  const { currentPrice, ema20, ema50, ema200 } = input;
  if (currentPrice === null || ema20 === null || ema50 === null) {
    return "UNKNOWN";
  }
  const shortBull = currentPrice > ema20 && ema20 > ema50;
  const shortBear = currentPrice < ema20 && ema20 < ema50;
  if (ema200 === null) {
    if (shortBull) {
      return "BULLISH";
    }
    if (shortBear) {
      return "BEARISH";
    }
    return "NEUTRAL";
  }
  if (shortBull && ema50 > ema200) {
    return "BULLISH";
  }
  if (shortBear && ema50 < ema200) {
    return "BEARISH";
  }
  return "NEUTRAL";
}

/**
 * Momentum from RSI and MACD histogram. Not a buy/sell signal.
 *
 * UNKNOWN: both rsi14 and macdHistogram are null
 * STRONG: rsi >= 70 AND histogram > 0 (both required)
 * WEAK: rsi <= 30 AND histogram < 0 (both required)
 * POSITIVE: rsi > 50 and histogram is null or >= 0; or rsi is null and histogram > 0
 * NEGATIVE: rsi < 50 and histogram is null or <= 0; or rsi is null and histogram < 0
 * NEUTRAL: otherwise (including rsi === 50, histogram === 0, or RSI/MACD disagreement)
 */
export function classifyMomentum(input: {
  rsi14: number | null;
  macdHistogram: number | null;
}): Momentum {
  const { rsi14, macdHistogram } = input;
  if (rsi14 === null && macdHistogram === null) {
    return "UNKNOWN";
  }
  if (
    rsi14 !== null &&
    macdHistogram !== null &&
    rsi14 >= MOMENTUM_THRESHOLDS.rsiStrong &&
    macdHistogram > 0
  ) {
    return "STRONG";
  }
  if (
    rsi14 !== null &&
    macdHistogram !== null &&
    rsi14 <= MOMENTUM_THRESHOLDS.rsiWeak &&
    macdHistogram < 0
  ) {
    return "WEAK";
  }
  if (rsi14 !== null && macdHistogram !== null) {
    if (rsi14 > MOMENTUM_THRESHOLDS.rsiPositive && macdHistogram >= 0) {
      return "POSITIVE";
    }
    if (rsi14 < MOMENTUM_THRESHOLDS.rsiNegative && macdHistogram <= 0) {
      return "NEGATIVE";
    }
    return "NEUTRAL";
  }
  if (rsi14 !== null) {
    if (rsi14 > MOMENTUM_THRESHOLDS.rsiPositive) {
      return "POSITIVE";
    }
    if (rsi14 < MOMENTUM_THRESHOLDS.rsiNegative) {
      return "NEGATIVE";
    }
    return "NEUTRAL";
  }
  if (macdHistogram !== null) {
    if (macdHistogram > 0) {
      return "POSITIVE";
    }
    if (macdHistogram < 0) {
      return "NEGATIVE";
    }
    return "NEUTRAL";
  }
  return "UNKNOWN";
}

/**
 * Volatility from ATR / price using VOLATILITY_THRESHOLDS.
 * LOW < 1%, HIGH > 3%, NORMAL in between. Not a trade signal.
 */
export function classifyVolatility(input: {
  atr14: number | null;
  currentPrice: number | null;
}): Volatility {
  const { atr14, currentPrice } = input;
  if (atr14 === null || currentPrice === null || currentPrice === 0) {
    return "UNKNOWN";
  }
  const ratio = atr14 / currentPrice;
  if (ratio < VOLATILITY_THRESHOLDS.lowMax) {
    return "LOW";
  }
  if (ratio > VOLATILITY_THRESHOLDS.highMin) {
    return "HIGH";
  }
  return "NORMAL";
}

/**
 * Combined technical condition. Not a trading recommendation.
 * No BUY / SELL / LONG / SHORT.
 *
 * UNKNOWN: trend or momentum is UNKNOWN
 * FAVORABLE: BULLISH + (POSITIVE or STRONG) + volatility not HIGH
 * UNFAVORABLE: BEARISH + (NEGATIVE or WEAK)
 * MIXED: otherwise
 */
export function classifyTechnicalCondition(input: {
  trend: Trend;
  momentum: Momentum;
  volatility: Volatility;
}): TechnicalCondition {
  const { trend, momentum, volatility } = input;
  if (trend === "UNKNOWN" || momentum === "UNKNOWN") {
    return "UNKNOWN";
  }
  if (
    trend === "BULLISH" &&
    (momentum === "POSITIVE" || momentum === "STRONG") &&
    volatility !== "HIGH"
  ) {
    return "FAVORABLE";
  }
  if (
    trend === "BEARISH" &&
    (momentum === "NEGATIVE" || momentum === "WEAK")
  ) {
    return "UNFAVORABLE";
  }
  return "MIXED";
}
