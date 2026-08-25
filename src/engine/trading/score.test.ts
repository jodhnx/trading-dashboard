import { describe, expect, it } from "vitest";
import { SCORE_WEIGHT_TOTAL, SCORE_WEIGHTS, scoreSetup } from "./score";
import { emptyTechnicalSnapshot } from "../technical/technical-snapshot";
import type { TechnicalSnapshot } from "../technical/technical-snapshot";

function snapshot(overrides: Partial<TechnicalSnapshot>): TechnicalSnapshot {
  return {
    ...emptyTechnicalSnapshot("NVDA", "1day", "LIVE", null),
    currentPrice: 100,
    ema20: 99,
    ema50: 97,
    ema200: 90,
    rsi14: 60,
    macd: 1,
    macdSignal: 0.4,
    macdHistogram: 0.3,
    atr14: 2,
    trend: "BULLISH",
    momentum: "POSITIVE",
    volatility: "NORMAL",
    volumeTrend: "INCREASING",
    volumeRatio: 1.4,
    supportLevels: [{ price: 96, strength: 2, touches: 2 }],
    resistanceLevels: [{ price: 108, strength: 2, touches: 2 }],
    ...overrides,
  };
}

describe("setup score", () => {
  it("weights sum to 100", () => {
    expect(SCORE_WEIGHT_TOTAL).toBe(100);
    expect(SCORE_WEIGHTS.trend).toBe(20);
    expect(SCORE_WEIGHTS.momentum).toBe(15);
    expect(SCORE_WEIGHTS.emaAlignment).toBe(15);
    expect(SCORE_WEIGHTS.rsi).toBe(10);
    expect(SCORE_WEIGHTS.macd).toBe(15);
    expect(SCORE_WEIGHTS.volume).toBe(10);
    expect(SCORE_WEIGHTS.volatility).toBe(5);
    expect(SCORE_WEIGHTS.supportResistance).toBe(10);
  });

  it("scores a bullish setup high", () => {
    const result = scoreSetup(snapshot({}), "LONG");
    expect(result.total).toBeGreaterThanOrEqual(70);
    expect(result.trend).toBe(100);
    expect(result.emaAlignment).toBe(100);
    expect(result.macd).toBe(100);
  });

  it("scores a bearish setup high on the short side", () => {
    const result = scoreSetup(
      snapshot({
        currentPrice: 80,
        ema20: 82,
        ema50: 85,
        ema200: 95,
        rsi14: 38,
        macd: -1,
        macdSignal: -0.4,
        macdHistogram: -0.3,
        trend: "BEARISH",
        momentum: "NEGATIVE",
        supportLevels: [{ price: 70, strength: 2, touches: 2 }],
        resistanceLevels: [{ price: 84, strength: 2, touches: 2 }],
      }),
      "SHORT",
    );
    expect(result.total).toBeGreaterThanOrEqual(70);
    expect(result.trend).toBe(100);
  });

  it("scores mixed conditions lower", () => {
    const mixed = scoreSetup(
      snapshot({
        currentPrice: 100,
        ema20: 102,
        ema50: 97,
        trend: "NEUTRAL",
        momentum: "NEUTRAL",
        rsi14: 50,
        macd: -0.2,
        macdSignal: 0.1,
        macdHistogram: -0.2,
        volumeTrend: "DECREASING",
        volumeRatio: 0.5,
        volatility: "HIGH",
      }),
      "LONG",
    );
    expect(mixed.total).toBeLessThan(50);
  });

  it("scores insufficient data near zero on missing EMAs and RSI", () => {
    const result = scoreSetup(
      snapshot({
        ema20: null,
        ema50: null,
        rsi14: null,
        macd: null,
        macdHistogram: null,
        trend: "UNKNOWN",
        momentum: "UNKNOWN",
      }),
      "LONG",
    );
    expect(result.total).toBeLessThan(40);
    expect(result.emaAlignment).toBe(0);
    expect(result.rsi).toBe(0);
    expect(result.macd).toBe(0);
  });
});
