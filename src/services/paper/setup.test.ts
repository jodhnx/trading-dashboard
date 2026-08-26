import { describe, expect, it } from "vitest";
import { isPaperTradeableSetup } from "./setup";
import type { TradingSetup } from "@/engine/trading/types";

function baseSetup(overrides: Partial<TradingSetup> = {}): TradingSetup {
  return {
    symbol: "NVDA",
    timeframe: "1day",
    direction: "LONG",
    status: "VALID",
    score: 8,
    entry: 212,
    stopLoss: 205,
    takeProfit: 225,
    riskPerUnit: 7,
    rewardPerUnit: 13,
    riskReward: 1.86,
    accountCapital: 10000,
    riskPercent: 0.005,
    riskAmount: 50,
    positionSize: 10,
    positionValue: 2120,
    actualRisk: 70,
    dataStatus: "LIVE",
    reasons: [],
    rejectReasons: [],
    confirmation: {
      direction: "LONG",
      confirmation: "STRONG",
      trend: "BULLISH",
      momentum: "POSITIVE",
      ema: "BULLISH",
      macd: "POSITIVE",
      atrValid: true,
      rrValid: true,
      explain: "strong",
    },
    createdAt: new Date("2026-08-25T12:00:00.000Z"),
    ...overrides,
  };
}

describe("isPaperTradeableSetup", () => {
  it("accepts a valid live setup", () => {
    expect(isPaperTradeableSetup(baseSetup()).ok).toBe(true);
  });

  it("rejects NO_TRADE", () => {
    expect(isPaperTradeableSetup(baseSetup({ direction: "NO_TRADE" })).ok).toBe(
      false,
    );
  });

  it("rejects invalid statuses", () => {
    for (const status of ["INVALID", "REJECTED"] as const) {
      expect(isPaperTradeableSetup(baseSetup({ status })).ok).toBe(false);
    }
  });

  it("rejects stale, mock, and unavailable data", () => {
    for (const dataStatus of ["STALE", "MOCK", "UNAVAILABLE"]) {
      expect(isPaperTradeableSetup(baseSetup({ dataStatus })).ok).toBe(false);
    }
  });

  it("rejects missing levels", () => {
    expect(isPaperTradeableSetup(baseSetup({ entry: null })).ok).toBe(false);
    expect(isPaperTradeableSetup(baseSetup({ positionSize: 0 })).ok).toBe(false);
  });
});
