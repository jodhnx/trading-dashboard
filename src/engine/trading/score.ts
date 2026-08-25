import type { TechnicalSnapshot } from "../technical/technical-snapshot";
import type { SetupDirection } from "./types";

/**
 * Setup score weights. Each component is scored 0–100, then combined:
 * score = Σ (weight_i × component_i) / 100
 *
 * Score is a technical alignment index, not a probability and not expected return.
 * Do not display it as "80% chance".
 */
export const SCORE_WEIGHTS = {
  /** Trend classification from the technical engine. */
  trend: 20,
  /** Momentum (RSI + MACD histogram). */
  momentum: 15,
  /** Price vs EMA20 vs EMA50 vs EMA200 stack. */
  emaAlignment: 15,
  /** RSI 14 level relative to the setup direction. */
  rsi: 10,
  /** MACD line vs signal and histogram sign. */
  macd: 15,
  /** Volume trend / ratio confirmation. */
  volume: 10,
  /** ATR/price regime. HIGH volatility scores lower. */
  volatility: 5,
  /** Room to nearest support/resistance. */
  supportResistance: 10,
} as const;

export const SCORE_WEIGHT_TOTAL = Object.values(SCORE_WEIGHTS).reduce(
  (sum, weight) => sum + weight,
  0,
);

/** Minimum directional score required to allow LONG/SHORT instead of NO_TRADE. */
export const MIN_SCORE_FOR_TRADE = 60;

export type ScoreBreakdown = {
  trend: number;
  momentum: number;
  emaAlignment: number;
  rsi: number;
  macd: number;
  volume: number;
  volatility: number;
  supportResistance: number;
  total: number;
  reasons: string[];
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

function emaBullish(snapshot: TechnicalSnapshot): boolean {
  const { currentPrice, ema20, ema50, ema200 } = snapshot;
  if (currentPrice === null || ema20 === null || ema50 === null) {
    return false;
  }
  if (!(currentPrice > ema20 && ema20 > ema50)) {
    return false;
  }
  return ema200 === null || ema50 > ema200;
}

function emaBearish(snapshot: TechnicalSnapshot): boolean {
  const { currentPrice, ema20, ema50, ema200 } = snapshot;
  if (currentPrice === null || ema20 === null || ema50 === null) {
    return false;
  }
  if (!(currentPrice < ema20 && ema20 < ema50)) {
    return false;
  }
  return ema200 === null || ema50 < ema200;
}

function scoreTrend(snapshot: TechnicalSnapshot, direction: "LONG" | "SHORT"): number {
  if (direction === "LONG") {
    if (snapshot.trend === "BULLISH") return 100;
    if (snapshot.trend === "NEUTRAL") return 35;
    return 0;
  }
  if (snapshot.trend === "BEARISH") return 100;
  if (snapshot.trend === "NEUTRAL") return 35;
  return 0;
}

function scoreMomentum(snapshot: TechnicalSnapshot, direction: "LONG" | "SHORT"): number {
  const { momentum } = snapshot;
  if (direction === "LONG") {
    if (momentum === "STRONG") return 100;
    if (momentum === "POSITIVE") return 80;
    if (momentum === "NEUTRAL") return 40;
    return 0;
  }
  if (momentum === "WEAK") return 100;
  if (momentum === "NEGATIVE") return 80;
  if (momentum === "NEUTRAL") return 40;
  return 0;
}

function scoreEma(snapshot: TechnicalSnapshot, direction: "LONG" | "SHORT"): number {
  if (snapshot.ema20 === null || snapshot.ema50 === null || snapshot.currentPrice === null) {
    return 0;
  }
  if (direction === "LONG") {
    if (emaBullish(snapshot)) return 100;
    if (snapshot.currentPrice > snapshot.ema20) return 45;
    return 0;
  }
  if (emaBearish(snapshot)) return 100;
  if (snapshot.currentPrice < snapshot.ema20) return 45;
  return 0;
}

function scoreRsi(snapshot: TechnicalSnapshot, direction: "LONG" | "SHORT"): number {
  const rsi = snapshot.rsi14;
  if (rsi === null) {
    return 0;
  }
  if (direction === "LONG") {
    if (rsi >= 55 && rsi <= 70) return 100;
    if (rsi > 50 && rsi < 55) return 70;
    if (rsi > 70 && rsi <= 80) return 45;
    if (rsi > 40 && rsi <= 50) return 35;
    return 10;
  }
  if (rsi >= 30 && rsi <= 45) return 100;
  if (rsi > 45 && rsi < 50) return 70;
  if (rsi >= 20 && rsi < 30) return 45;
  if (rsi >= 50 && rsi < 60) return 35;
  return 10;
}

function scoreMacd(snapshot: TechnicalSnapshot, direction: "LONG" | "SHORT"): number {
  const { macd, macdSignal, macdHistogram } = snapshot;
  if (macdHistogram === null && macd === null) {
    return 0;
  }
  const hist = macdHistogram;
  const aboveSignal =
    macd !== null && macdSignal !== null ? macd > macdSignal : hist !== null && hist > 0;
  if (direction === "LONG") {
    if (hist !== null && hist > 0 && aboveSignal) return 100;
    if (hist !== null && hist > 0) return 70;
    if (hist === 0) return 40;
    return 0;
  }
  const belowSignal =
    macd !== null && macdSignal !== null ? macd < macdSignal : hist !== null && hist < 0;
  if (hist !== null && hist < 0 && belowSignal) return 100;
  if (hist !== null && hist < 0) return 70;
  if (hist === 0) return 40;
  return 0;
}

function scoreVolume(snapshot: TechnicalSnapshot): number {
  if (snapshot.volumeTrend === "INCREASING") return 100;
  if (snapshot.volumeRatio !== null && snapshot.volumeRatio >= 1.2) return 80;
  if (snapshot.volumeTrend === "NEUTRAL") return 55;
  if (snapshot.volumeTrend === "UNKNOWN") return 40;
  return 20;
}

function scoreVolatility(snapshot: TechnicalSnapshot): number {
  if (snapshot.volatility === "NORMAL") return 100;
  if (snapshot.volatility === "LOW") return 70;
  if (snapshot.volatility === "HIGH") return 30;
  return 40;
}

function scoreSupportResistance(
  snapshot: TechnicalSnapshot,
  direction: "LONG" | "SHORT",
): number {
  const price = snapshot.currentPrice;
  const atr = snapshot.atr14;
  if (price === null || atr === null || atr <= 0) {
    return 40;
  }
  if (direction === "LONG") {
    const support = snapshot.supportLevels.filter((level) => level.price < price);
    const resistance = snapshot.resistanceLevels.filter((level) => level.price > price);
    const nearestSupport = support.sort((a, b) => b.price - a.price)[0];
    const nearestResistance = resistance.sort((a, b) => a.price - b.price)[0];
    let score = 50;
    if (nearestSupport && price - nearestSupport.price <= atr * 2) {
      score += 30;
    }
    if (nearestResistance && nearestResistance.price - price < atr * 0.3) {
      score -= 40;
    } else if (nearestResistance && nearestResistance.price - price >= atr) {
      score += 20;
    }
    return clampScore(score);
  }
  const resistance = snapshot.resistanceLevels.filter((level) => level.price > price);
  const support = snapshot.supportLevels.filter((level) => level.price < price);
  const nearestResistance = resistance.sort((a, b) => a.price - b.price)[0];
  const nearestSupport = support.sort((a, b) => b.price - a.price)[0];
  let score = 50;
  if (nearestResistance && nearestResistance.price - price <= atr * 2) {
    score += 30;
  }
  if (nearestSupport && price - nearestSupport.price < atr * 0.3) {
    score -= 40;
  } else if (nearestSupport && price - nearestSupport.price >= atr) {
    score += 20;
  }
  return clampScore(score);
}

export function scoreSetup(
  snapshot: TechnicalSnapshot,
  direction: SetupDirection,
): ScoreBreakdown {
  const oriented: "LONG" | "SHORT" = direction === "SHORT" ? "SHORT" : "LONG";
  const trend = scoreTrend(snapshot, oriented);
  const momentum = scoreMomentum(snapshot, oriented);
  const emaAlignment = scoreEma(snapshot, oriented);
  const rsi = scoreRsi(snapshot, oriented);
  const macd = scoreMacd(snapshot, oriented);
  const volume = scoreVolume(snapshot);
  const volatility = scoreVolatility(snapshot);
  const supportResistance = scoreSupportResistance(snapshot, oriented);

  const weighted =
    (SCORE_WEIGHTS.trend * trend +
      SCORE_WEIGHTS.momentum * momentum +
      SCORE_WEIGHTS.emaAlignment * emaAlignment +
      SCORE_WEIGHTS.rsi * rsi +
      SCORE_WEIGHTS.macd * macd +
      SCORE_WEIGHTS.volume * volume +
      SCORE_WEIGHTS.volatility * volatility +
      SCORE_WEIGHTS.supportResistance * supportResistance) /
    SCORE_WEIGHT_TOTAL;

  const reasons: string[] = [];
  if (oriented === "LONG") {
    if (trend >= 100) reasons.push("Bullish trend");
    if (emaAlignment >= 100) reasons.push("Bullish EMA alignment");
    if (macd >= 70) reasons.push("Positive MACD");
    if (rsi >= 70) reasons.push("RSI supports the long setup");
    else if (snapshot.rsi14 !== null) reasons.push("RSI not extreme");
  } else {
    if (trend >= 100) reasons.push("Bearish trend");
    if (emaAlignment >= 100) reasons.push("Bearish EMA alignment");
    if (macd >= 70) reasons.push("Negative MACD");
    if (rsi >= 70) reasons.push("RSI supports the short setup");
    else if (snapshot.rsi14 !== null) reasons.push("RSI not extreme");
  }
  if (volume >= 80) reasons.push("Volume confirmation");
  if (volatility === 30) reasons.push("High volatility");
  if (volatility === 100) reasons.push("Normal volatility");

  return {
    trend,
    momentum,
    emaAlignment,
    rsi,
    macd,
    volume,
    volatility,
    supportResistance,
    total: clampScore(weighted),
    reasons,
  };
}

export { emaBullish, emaBearish };
