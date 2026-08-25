import { describe, expect, it } from "vitest";
import { buildTradingSetup, classifyDirection } from "./setup";
import { emptyTechnicalSnapshot } from "../technical/technical-snapshot";
import type { TechnicalSnapshot } from "../technical/technical-snapshot";
import type { TradingRiskSettings } from "./types";

const settings: TradingRiskSettings = {
  accountCapital: 10_000,
  maxRiskPercent: 0.01,
  maxPositionPercent: 0.2,
  minimumRiskReward: 2,
};

function liveSnapshot(overrides: Partial<TechnicalSnapshot> = {}): TechnicalSnapshot {
  return {
    ...emptyTechnicalSnapshot("NVDA", "1day", "LIVE", null),
    currentPrice: 100,
    previousClose: 99,
    ema20: 99,
    ema50: 97,
    ema200: 90,
    rsi14: 60,
    macd: 1.2,
    macdSignal: 0.8,
    macdHistogram: 0.4,
    atr14: 5,
    trend: "BULLISH",
    momentum: "POSITIVE",
    volatility: "NORMAL",
    volumeTrend: "INCREASING",
    volumeRatio: 1.3,
    supportLevels: [],
    resistanceLevels: [],
    ...overrides,
  };
}

describe("direction rules", () => {
  it("classifies a aligned bullish snapshot as LONG", () => {
    expect(classifyDirection(liveSnapshot()).direction).toBe("LONG");
  });

  it("classifies a aligned bearish snapshot as SHORT", () => {
    expect(
      classifyDirection(
        liveSnapshot({
          currentPrice: 80,
          ema20: 82,
          ema50: 85,
          ema200: 95,
          rsi14: 35,
          macd: -1,
          macdSignal: -0.4,
          macdHistogram: -0.5,
          trend: "BEARISH",
          momentum: "WEAK",
        }),
      ).direction,
    ).toBe("SHORT");
  });

  it("returns NO_TRADE when trend is neutral", () => {
    const result = classifyDirection(liveSnapshot({ trend: "NEUTRAL" }));
    expect(result.direction).toBe("NO_TRADE");
    expect(result.reasons.join(" ")).toMatch(/Trend is neutral/i);
  });
});

describe("buildTradingSetup", () => {
  const now = new Date("2026-08-24T18:00:00.000Z");

  it("builds the reference LONG setup", () => {
    const setup = buildTradingSetup({
      snapshot: liveSnapshot(),
      settings,
      now,
      atrMultiplier: 1,
    });
    expect(setup.direction).toBe("LONG");
    expect(setup.status).toBe("VALID");
    expect(setup.entry).toBeCloseTo(100, 10);
    expect(setup.stopLoss).toBeCloseTo(95, 10);
    expect(setup.takeProfit).toBeCloseTo(110, 10);
    expect(setup.riskPerUnit).toBeCloseTo(5, 10);
    expect(setup.riskAmount).toBeCloseTo(100, 10);
    expect(setup.positionSize).toBeCloseTo(20, 10);
    expect(setup.positionValue).toBeCloseTo(2000, 10);
    expect(setup.actualRisk).toBeCloseTo(100, 10);
    expect(setup.riskReward).toBeCloseTo(2, 10);
    expect(setup.score).toBeGreaterThanOrEqual(60);
    expect(setup.rejectReasons).toEqual([]);
    expect(setup.reasons.length).toBeGreaterThan(0);
    expect(JSON.stringify(setup)).not.toMatch(/OPENAI|80% chance/i);
  });

  it("builds a SHORT setup", () => {
    const setup = buildTradingSetup({
      snapshot: liveSnapshot({
        currentPrice: 100,
        ema20: 102,
        ema50: 105,
        ema200: 110,
        rsi14: 35,
        macd: -1,
        macdSignal: -0.3,
        macdHistogram: -0.4,
        trend: "BEARISH",
        momentum: "NEGATIVE",
      }),
      settings,
      now,
      atrMultiplier: 1,
    });
    expect(setup.direction).toBe("SHORT");
    expect(setup.status).toBe("VALID");
    expect(setup.stopLoss).toBeCloseTo(105, 10);
    expect(setup.takeProfit).toBeCloseTo(90, 10);
    expect(setup.riskPerUnit).toBeCloseTo(5, 10);
  });

  it("returns NO_TRADE for mixed signals", () => {
    const setup = buildTradingSetup({
      snapshot: liveSnapshot({ trend: "NEUTRAL", momentum: "NEGATIVE" }),
      settings,
      now,
    });
    expect(setup.direction).toBe("NO_TRADE");
    expect(setup.status).toBe("REJECTED");
    expect(setup.rejectReasons).toContain("NO_TRADE");
  });

  it("rejects UNAVAILABLE data", () => {
    const setup = buildTradingSetup({
      snapshot: emptyTechnicalSnapshot("NVDA", "1day"),
      settings,
      now,
    });
    expect(setup.status).toBe("REJECTED");
    expect(setup.rejectReasons).toContain("INSUFFICIENT_DATA");
    expect(setup.entry).toBeNull();
  });

  it("never marks STALE as VALID", () => {
    const setup = buildTradingSetup({
      snapshot: liveSnapshot({ dataStatus: "STALE" }),
      settings,
      now,
      atrMultiplier: 1,
    });
    expect(setup.status).toBe("REJECTED");
    expect(setup.rejectReasons).toContain("STALE_DATA");
    expect(setup.entry).toBe(100);
  });

  it("never marks MOCK as a live VALID setup", () => {
    const setup = buildTradingSetup({
      snapshot: liveSnapshot({ dataStatus: "MOCK" }),
      settings,
      now,
      atrMultiplier: 1,
    });
    expect(setup.status).toBe("REJECTED");
    expect(setup.rejectReasons).toContain("MOCK_DATA");
  });

  it("uses only snapshot fields (no look-ahead)", () => {
    const past = liveSnapshot({ currentPrice: 100, asOf: new Date("2026-08-01T00:00:00.000Z") });
    const futurePrice = liveSnapshot({
      currentPrice: 180,
      asOf: new Date("2026-08-24T00:00:00.000Z"),
    });
    const fromPast = buildTradingSetup({
      snapshot: past,
      settings,
      now,
      atrMultiplier: 1,
    });
    expect(fromPast.entry).toBe(100);
    expect(fromPast.entry).not.toBe(futurePrice.currentPrice);
  });

  it("rejects invalid risk settings", () => {
    const setup = buildTradingSetup({
      snapshot: liveSnapshot(),
      settings: { ...settings, accountCapital: 0 },
      now,
    });
    expect(setup.status).toBe("INVALID");
    expect(setup.rejectReasons).toContain("INVALID_RISK");
  });

  it("applies the max position cap on a full setup", () => {
    const setup = buildTradingSetup({
      snapshot: liveSnapshot(),
      settings: { ...settings, maxPositionPercent: 0.1 },
      now,
      atrMultiplier: 1,
    });
    expect(setup.positionSize).toBeCloseTo(10, 10);
    expect(setup.actualRisk).toBeCloseTo(50, 10);
    expect(setup.actualRisk!).toBeLessThanOrEqual(100);
  });
});
