import { describe, expect, it } from "vitest";
import {
  computeMaxDrawdown,
  computeProfitFactor,
  computeWinRate,
  buildBacktestResult,
} from "./metrics";
import type { BacktestTrade, EquityPoint } from "./types";

describe("backtest metrics", () => {
  const trades: BacktestTrade[] = [
    {
      id: "bt-1",
      side: "LONG",
      entryTime: "2026-01-01T00:00:00.000Z",
      exitTime: "2026-01-02T00:00:00.000Z",
      entryPrice: 100,
      exitPrice: 110,
      quantity: 1,
      stopLoss: 95,
      takeProfit: 115,
      riskAmount: 5,
      realizedPnL: 10,
      realizedPnLPercent: 10,
      exitReason: "TAKE_PROFIT",
      setupScore: 70,
      technicalCondition: "BULLISH",
      dataStatus: "CACHED",
      decisionTime: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "bt-2",
      side: "LONG",
      entryTime: "2026-01-03T00:00:00.000Z",
      exitTime: "2026-01-04T00:00:00.000Z",
      entryPrice: 100,
      exitPrice: 95,
      quantity: 1,
      stopLoss: 95,
      takeProfit: 110,
      riskAmount: 5,
      realizedPnL: -5,
      realizedPnLPercent: -5,
      exitReason: "STOP_LOSS",
      setupScore: 65,
      technicalCondition: "BULLISH",
      dataStatus: "CACHED",
      decisionTime: "2026-01-03T00:00:00.000Z",
    },
  ];

  it("computes win rate from closed trades", () => {
    expect(computeWinRate(trades)).toBe(0.5);
    expect(computeWinRate([])).toBeNull();
  });

  it("computes profit factor", () => {
    expect(computeProfitFactor(trades)).toBe(2);
    expect(computeProfitFactor([trades[0]!])).toBeNull();
  });

  it("computes max drawdown from equity curve", () => {
    const curve: EquityPoint[] = [
      {
        timestamp: "2026-01-01T00:00:00.000Z",
        cash: 0,
        invested: 10000,
        equity: 10000,
        unrealizedPnL: 0,
        drawdown: 0,
      },
      {
        timestamp: "2026-01-02T00:00:00.000Z",
        cash: 0,
        invested: 11000,
        equity: 11000,
        unrealizedPnL: 0,
        drawdown: 0,
      },
      {
        timestamp: "2026-01-03T00:00:00.000Z",
        cash: 0,
        invested: 9000,
        equity: 9000,
        unrealizedPnL: 0,
        drawdown: 0,
      },
    ];
    expect(computeMaxDrawdown(curve)).toBeCloseTo(2000 / 11000);
  });

  it("builds aggregate backtest result", () => {
    const result = buildBacktestResult({
      symbol: "NVDA",
      timeframe: "1day",
      from: "2026-01-01",
      to: "2026-06-01",
      startingCapital: 10000,
      endingCapital: 10005,
      dataStatus: "MOCK",
      trades,
      equityCurve: [],
    });
    expect(result.totalPnL).toBe(5);
    expect(result.dataStatus).toBe("MOCK");
    expect(result.feesSlippageModeled).toBe(false);
  });
});
