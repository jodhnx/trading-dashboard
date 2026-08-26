import { describe, expect, it } from "vitest";
import { emptyTechnicalSnapshot } from "../technical/technical-snapshot";
import type { TechnicalSnapshot } from "../technical/technical-snapshot";
import { buildTradingSetup, classifyDirection } from "./setup";
import { evaluateSetupConfirmation } from "./confirmation";
import type { TradingRiskSettings } from "./types";

const settings: TradingRiskSettings = {
  accountCapital: 10_000,
  maxRiskPercent: 0.01,
  maxPositionPercent: 0.2,
  minimumRiskReward: 2,
};

function base(overrides: Partial<TechnicalSnapshot> = {}): TechnicalSnapshot {
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

describe("Phase 21 confirmation model", () => {
  it("LONG: trend+momentum+EMA, MACD neutral → VALID CONFIRMED", () => {
    const snapshot = base({ macdHistogram: 0, macd: 0, macdSignal: 0 });
    const conf = evaluateSetupConfirmation(snapshot);
    expect(conf.direction).toBe("LONG");
    expect(conf.confirmation).toBe("CONFIRMED");
    expect(classifyDirection(snapshot).direction).toBe("LONG");
    const setup = buildTradingSetup({ snapshot, settings, atrMultiplier: 1 });
    expect(setup.status).toBe("VALID");
    expect(setup.entry).toBe(100);
    expect(setup.stopLoss).not.toBeNull();
    expect(setup.takeProfit).not.toBeNull();
  });

  it("LONG: trend+momentum+MACD, EMA neutral → VALID CONFIRMED", () => {
    const snapshot = base({
      currentPrice: 100,
      ema20: 101,
      ema50: 97,
      ema200: 90,
      macdHistogram: 0.5,
    });
    const conf = evaluateSetupConfirmation(snapshot);
    expect(conf.direction).toBe("LONG");
    expect(conf.confirmation).toBe("CONFIRMED");
    expect(conf.explain).toMatch(/MACD/i);
    const setup = buildTradingSetup({ snapshot, settings, atrMultiplier: 1 });
    expect(setup.status).toBe("VALID");
    expect(setup.direction).toBe("LONG");
  });

  it("LONG: trend bullish, momentum neutral, EMA+MACD → WATCH not VALID", () => {
    const snapshot = base({ momentum: "NEUTRAL" });
    const conf = evaluateSetupConfirmation(snapshot);
    expect(conf.direction).toBe("NONE");
    expect(conf.confirmation).toBe("WATCH");
    expect(conf.explain).toMatch(/momentum/i);
    expect(classifyDirection(snapshot).direction).toBe("NO_TRADE");
    const setup = buildTradingSetup({ snapshot, settings, atrMultiplier: 1 });
    expect(setup.status).toBe("REJECTED");
    expect(setup.entry).toBeNull();
  });

  it("LONG: trend neutral, momentum+EMA+MACD → WATCH not VALID", () => {
    const snapshot = base({ trend: "NEUTRAL" });
    const conf = evaluateSetupConfirmation(snapshot);
    expect(conf.direction).toBe("NONE");
    expect(conf.confirmation).toBe("WATCH");
    expect(conf.explain).toMatch(/not directional/i);
    expect(classifyDirection(snapshot).direction).toBe("NO_TRADE");
  });

  it("all four aligned → STRONG confirmation", () => {
    const conf = evaluateSetupConfirmation(base());
    expect(conf.direction).toBe("LONG");
    expect(conf.confirmation).toBe("STRONG");
  });

  it("SHORT: trend+momentum+MACD without EMA → VALID", () => {
    const snapshot = base({
      currentPrice: 100,
      ema20: 99,
      ema50: 97,
      ema200: 90,
      rsi14: 35,
      macd: -1,
      macdSignal: -0.3,
      macdHistogram: -0.4,
      trend: "BEARISH",
      momentum: "NEGATIVE",
    });
    // EMA is bullish stack here; MACD negative should still confirm SHORT
    const conf = evaluateSetupConfirmation(snapshot);
    expect(conf.direction).toBe("SHORT");
    expect(conf.confirmation).toBe("CONFIRMED");
    const setup = buildTradingSetup({ snapshot, settings, atrMultiplier: 1 });
    expect(setup.status).toBe("VALID");
    expect(setup.direction).toBe("SHORT");
    expect(setup.stopLoss).not.toBeNull();
  });

  it("SHORT: trend bearish, momentum neutral → WATCH", () => {
    const snapshot = base({
      currentPrice: 80,
      ema20: 82,
      ema50: 85,
      ema200: 95,
      macdHistogram: -0.5,
      trend: "BEARISH",
      momentum: "NEUTRAL",
    });
    const conf = evaluateSetupConfirmation(snapshot);
    expect(conf.confirmation).toBe("WATCH");
    expect(conf.explain).toMatch(/bearish momentum/i);
  });

  it("missing ATR → invalid / insufficient", () => {
    const snapshot = base({ atr14: null });
    const conf = evaluateSetupConfirmation(snapshot);
    expect(conf.atrValid).toBe(false);
    expect(classifyDirection(snapshot).direction).toBe("NO_TRADE");
  });

  it("preserves buildTradingSetup levels for confirmed setups", () => {
    const setup = buildTradingSetup({
      snapshot: base({ macdHistogram: 0 }),
      settings,
      atrMultiplier: 1,
    });
    expect(setup.status).toBe("VALID");
    expect(setup.entry).toBeCloseTo(100, 10);
    expect(setup.stopLoss).toBeCloseTo(95, 10);
    expect(setup.takeProfit).toBeCloseTo(110, 10);
    expect(setup.riskReward).toBeCloseTo(2, 10);
  });
});
