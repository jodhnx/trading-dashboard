import { describe, expect, it } from "vitest";
import {
  computePaperPerformanceSummary,
  groupPaperTradesByAsset,
  groupPaperTradesByExitReason,
  groupPaperTradesByScore,
  groupPaperTradesBySide,
} from "./paper-performance";
import type { StoredPaperTrade } from "@/services/paper/types";

function trade(overrides: Partial<StoredPaperTrade>): StoredPaperTrade {
  return {
    id: "t1",
    userId: "u1",
    positionId: "p1",
    assetId: "a1",
    symbol: "NVDA",
    side: "LONG",
    entryPrice: 100,
    exitPrice: 110,
    quantity: 1,
    riskAmount: 5,
    pnl: 10,
    pnlPercent: 10,
    stopLoss: 95,
    takeProfit: 115,
    setupScore: 72,
    setupSnapshot: null,
    status: "CLOSED",
    closeReason: "TAKE_PROFIT",
    openedAt: "2026-01-01T00:00:00.000Z",
    closedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("paper performance analytics", () => {
  const trades: StoredPaperTrade[] = [
    trade({ id: "t1", pnl: 100, setupScore: 80, closeReason: "TAKE_PROFIT" }),
    trade({
      id: "t2",
      pnl: -40,
      setupScore: 65,
      closeReason: "STOP_LOSS",
      closedAt: "2026-01-03T00:00:00.000Z",
    }),
    trade({
      id: "t3",
      symbol: "BTC",
      pnl: 20,
      setupScore: 91,
      closeReason: "MANUAL",
      side: "SHORT",
      closedAt: "2026-01-04T00:00:00.000Z",
    }),
  ];

  it("computes summary metrics from stored closed trades", () => {
    const summary = computePaperPerformanceSummary({
      startingBalance: 10000,
      cash: 10080,
      closedTrades: trades,
      openPositions: [],
    });
    expect(summary.realizedPnL).toBe(80);
    expect(summary.totalTrades).toBe(3);
    expect(summary.winningTrades).toBe(2);
    expect(summary.losingTrades).toBe(1);
    expect(summary.winRate).toBeCloseTo(2 / 3);
    expect(summary.profitFactor).toBeCloseTo(120 / 40);
    expect(summary.totalReturn).toBeCloseTo(0.008);
    expect(summary.unrealizedPnL).toBe(0);
  });

  it("returns null unrealized and equity when open positions lack stored mark price", () => {
    const summary = computePaperPerformanceSummary({
      startingBalance: 10000,
      cash: 9000,
      closedTrades: [],
      openPositions: [
        {
          symbol: "NVDA",
          side: "LONG",
          quantity: 1,
          entryPrice: 100,
          currentPrice: null,
        },
      ],
    });
    expect(summary.unrealizedPnL).toBeNull();
    expect(summary.equity).toBeNull();
  });

  it("uses stored current price for unrealized P&L without live market data", () => {
    const summary = computePaperPerformanceSummary({
      startingBalance: 10000,
      cash: 9900,
      closedTrades: [],
      openPositions: [
        {
          symbol: "NVDA",
          side: "LONG",
          quantity: 1,
          entryPrice: 100,
          currentPrice: 105,
        },
      ],
    });
    expect(summary.unrealizedPnL).toBe(5);
    expect(summary.equity).toBe(10005);
  });

  it("groups by asset, side, score, and exit reason", () => {
    expect(groupPaperTradesByAsset(trades)).toHaveLength(2);
    expect(groupPaperTradesBySide(trades).find((row) => row.side === "LONG")?.trades).toBe(2);
    expect(groupPaperTradesByExitReason(trades).find((row) => row.reason === "MANUAL")?.count).toBe(1);
    const bucket8090 = groupPaperTradesByScore(trades).find((row) => row.bucket === "80–89");
    expect(bucket8090?.trades).toBe(1);
  });

  it("does not show zero for unavailable metrics", () => {
    const summary = computePaperPerformanceSummary({
      startingBalance: 10000,
      cash: 10000,
      closedTrades: [],
      openPositions: [],
    });
    expect(summary.winRate).toBeNull();
    expect(summary.profitFactor).toBeNull();
    expect(summary.maxDrawdown).toBeNull();
  });
});
