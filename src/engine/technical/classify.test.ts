import { describe, expect, it } from "vitest";
import {
  classifyMomentum,
  classifyTechnicalCondition,
  classifyTrend,
  classifyVolatility,
} from "./classify";
import { VOLATILITY_THRESHOLDS } from "./thresholds";

describe("trend classification", () => {
  it("is BULLISH when price is above aligned EMAs", () => {
    expect(
      classifyTrend({
        currentPrice: 110,
        ema20: 105,
        ema50: 100,
        ema200: 90,
      }),
    ).toBe("BULLISH");
  });

  it("is BEARISH when price is below aligned EMAs", () => {
    expect(
      classifyTrend({
        currentPrice: 80,
        ema20: 85,
        ema50: 90,
        ema200: 100,
      }),
    ).toBe("BEARISH");
  });

  it("is NEUTRAL when EMAs are mixed", () => {
    expect(
      classifyTrend({
        currentPrice: 110,
        ema20: 105,
        ema50: 100,
        ema200: 120,
      }),
    ).toBe("NEUTRAL");
  });

  it("is UNKNOWN without EMA20/50", () => {
    expect(
      classifyTrend({
        currentPrice: 100,
        ema20: null,
        ema50: 90,
        ema200: null,
      }),
    ).toBe("UNKNOWN");
  });
});

describe("momentum classification", () => {
  it("is POSITIVE when RSI is above 50 and histogram is non-negative", () => {
    expect(classifyMomentum({ rsi14: 60, macdHistogram: 0.1 })).toBe("POSITIVE");
  });

  it("is NEGATIVE when RSI is below 50 and histogram is non-positive", () => {
    expect(classifyMomentum({ rsi14: 40, macdHistogram: -0.1 })).toBe("NEGATIVE");
  });

  it("is NEUTRAL when RSI and MACD disagree", () => {
    expect(classifyMomentum({ rsi14: 60, macdHistogram: -0.2 })).toBe("NEUTRAL");
  });

  it("is STRONG and WEAK only when RSI and histogram agree at extremes", () => {
    expect(classifyMomentum({ rsi14: 75, macdHistogram: 0.4 })).toBe("STRONG");
    expect(classifyMomentum({ rsi14: 20, macdHistogram: -0.4 })).toBe("WEAK");
  });
});

describe("volatility classification", () => {
  it("uses the central ATR/price thresholds", () => {
    expect(classifyVolatility({ atr14: 0.5, currentPrice: 100 })).toBe("LOW");
    expect(
      classifyVolatility({
        atr14: 100 * ((VOLATILITY_THRESHOLDS.lowMax + VOLATILITY_THRESHOLDS.highMin) / 2),
        currentPrice: 100,
      }),
    ).toBe("NORMAL");
    expect(classifyVolatility({ atr14: 5, currentPrice: 100 })).toBe("HIGH");
    expect(classifyVolatility({ atr14: null, currentPrice: 100 })).toBe("UNKNOWN");
  });
});

describe("technical condition", () => {
  it("is FAVORABLE, MIXED, UNFAVORABLE, or UNKNOWN without implying a trade", () => {
    expect(
      classifyTechnicalCondition({
        trend: "BULLISH",
        momentum: "POSITIVE",
        volatility: "NORMAL",
      }),
    ).toBe("FAVORABLE");
    expect(
      classifyTechnicalCondition({
        trend: "BULLISH",
        momentum: "NEGATIVE",
        volatility: "NORMAL",
      }),
    ).toBe("MIXED");
    expect(
      classifyTechnicalCondition({
        trend: "BEARISH",
        momentum: "WEAK",
        volatility: "HIGH",
      }),
    ).toBe("UNFAVORABLE");
    expect(
      classifyTechnicalCondition({
        trend: "UNKNOWN",
        momentum: "POSITIVE",
        volatility: "LOW",
      }),
    ).toBe("UNKNOWN");
  });
});
