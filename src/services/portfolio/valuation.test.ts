import { describe, expect, it } from "vitest";
import {
  aggregateDataStatus,
  buildPortfolioSnapshot,
  valueHolding,
} from "./valuation";
import type { StoredHolding } from "./types";

function holding(partial: Partial<StoredHolding> & Pick<StoredHolding, "symbol">): StoredHolding {
  return {
    id: partial.id ?? `h-${partial.symbol}`,
    portfolioId: "p1",
    userId: "u1",
    assetId: `a-${partial.symbol}`,
    symbol: partial.symbol,
    quantity: partial.quantity ?? 10,
    averageEntryPrice: partial.averageEntryPrice ?? 100,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
  };
}

describe("portfolio valuation", () => {
  it("values a live holding and portfolio totals with cash", () => {
    const valued = valueHolding({
      holding: holding({ symbol: "NVDA", quantity: 10, averageEntryPrice: 180 }),
      name: "NVIDIA",
      quote: {
        symbol: "NVDA",
        name: "NVIDIA",
        price: 209.58,
        dataStatus: "LIVE",
        asOf: "2026-08-25T12:00:00.000Z",
        source: "twelve-data",
      },
    });

    expect(valued.investedValue).toBeCloseTo(1800, 5);
    expect(valued.marketValue).toBeCloseTo(2095.8, 5);
    expect(valued.unrealizedPnL).toBeCloseTo(295.8, 5);
    expect(valued.unrealizedPnLPercent).toBeCloseTo(16.4333, 2);
    expect(valued.dataStatus).toBe("LIVE");

    const snapshot = buildPortfolioSnapshot({
      portfolioId: "p1",
      currency: "EUR",
      cash: 2000,
      holdings: [valued],
      updatedAt: "2026-08-25T12:00:00.000Z",
    });

    expect(snapshot.totalInvested).toBeCloseTo(1800, 5);
    expect(snapshot.totalMarketValue).toBeCloseTo(2095.8, 5);
    expect(snapshot.totalPortfolioValue).toBeCloseTo(4095.8, 5);
    expect(snapshot.unrealizedPnL).toBeCloseTo(295.8, 5);
    expect(snapshot.realizedPnL).toBeNull();
    expect(snapshot.holdings[0]?.allocationPercent).toBeCloseTo(
      (2095.8 / 4095.8) * 100,
      4,
    );
    const cashAlloc = snapshot.allocation.find((row) => row.key === "CASH");
    expect(cashAlloc?.allocationPercent).toBeCloseTo((2000 / 4095.8) * 100, 4);
  });

  it("aggregates multiple holdings", () => {
    const nvda = valueHolding({
      holding: holding({ symbol: "NVDA", quantity: 10, averageEntryPrice: 180 }),
      name: "NVIDIA",
      quote: {
        symbol: "NVDA",
        name: "NVIDIA",
        price: 200,
        dataStatus: "LIVE",
        asOf: null,
        source: "twelve-data",
      },
    });
    const btc = valueHolding({
      holding: holding({
        symbol: "BTC",
        quantity: 0.1,
        averageEntryPrice: 70_000,
      }),
      name: "Bitcoin",
      quote: {
        symbol: "BTC",
        name: "Bitcoin",
        price: 78_000,
        dataStatus: "CACHED",
        asOf: null,
        source: "cache",
      },
    });

    const snapshot = buildPortfolioSnapshot({
      portfolioId: "p1",
      currency: "EUR",
      cash: 500,
      holdings: [nvda, btc],
      updatedAt: "2026-08-25T12:00:00.000Z",
    });

    expect(snapshot.totalInvested).toBeCloseTo(1800 + 7000, 5);
    expect(snapshot.totalMarketValue).toBeCloseTo(2000 + 7800, 5);
    expect(snapshot.totalPortfolioValue).toBeCloseTo(500 + 9800, 5);
    expect(snapshot.unrealizedPnL).toBeCloseTo(1000, 5);
    expect(snapshot.dataStatus).toBe("MIXED");
  });

  it("never invents prices when market data is missing", () => {
    const valued = valueHolding({
      holding: holding({ symbol: "XAU" }),
      name: "Gold",
      quote: {
        symbol: "XAU",
        name: "Gold",
        price: null,
        dataStatus: "UNAVAILABLE",
        asOf: null,
        source: null,
      },
    });

    expect(valued.currentPrice).toBeNull();
    expect(valued.marketValue).toBeNull();
    expect(valued.unrealizedPnL).toBeNull();
    expect(valued.unrealizedPnLPercent).toBeNull();
    expect(valued.dataStatus).toBe("DATA_UNAVAILABLE");
    expect(valued.investedValue).toBe(1000);

    const snapshot = buildPortfolioSnapshot({
      portfolioId: "p1",
      currency: "EUR",
      cash: 100,
      holdings: [valued],
      updatedAt: "2026-08-25T12:00:00.000Z",
    });

    expect(snapshot.totalMarketValue).toBeNull();
    expect(snapshot.totalPortfolioValue).toBeNull();
    expect(snapshot.unrealizedPnL).toBeNull();
    expect(snapshot.realizedPnL).toBeNull();
    expect(snapshot.holdings[0]?.allocationPercent).toBeNull();
  });

  it("preserves MOCK and STALE statuses (never promotes to LIVE)", () => {
    const mock = valueHolding({
      holding: holding({ symbol: "SPY" }),
      name: "S&P",
      quote: {
        symbol: "SPY",
        name: "S&P",
        price: 500,
        dataStatus: "MOCK",
        asOf: null,
        source: "mock",
      },
    });
    const stale = valueHolding({
      holding: holding({ symbol: "QQQ" }),
      name: "Nasdaq",
      quote: {
        symbol: "QQQ",
        name: "Nasdaq",
        price: 400,
        dataStatus: "STALE",
        asOf: null,
        source: "cache",
      },
    });

    expect(mock.dataStatus).toBe("MOCK");
    expect(stale.dataStatus).toBe("STALE");
  });

  it("treats non-positive or non-finite prices as unavailable", () => {
    for (const price of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const valued = valueHolding({
        holding: holding({ symbol: "NVDA" }),
        name: "NVIDIA",
        quote: {
          symbol: "NVDA",
          name: "NVIDIA",
          price,
          dataStatus: "LIVE",
          asOf: null,
          source: "twelve-data",
        },
      });
      expect(valued.currentPrice).toBeNull();
      expect(valued.dataStatus).toBe("DATA_UNAVAILABLE");
    }
  });

  it("marks empty portfolios without inventing market failure", () => {
    const snapshot = buildPortfolioSnapshot({
      portfolioId: "p1",
      currency: "EUR",
      cash: 2500,
      holdings: [],
      updatedAt: "2026-08-25T12:00:00.000Z",
    });
    expect(snapshot.totalInvested).toBe(0);
    expect(snapshot.totalMarketValue).toBe(0);
    expect(snapshot.totalPortfolioValue).toBe(2500);
    expect(snapshot.unrealizedPnL).toBe(0);
    expect(snapshot.dataStatus).toBe("LIVE");
  });

  it("aggregates status helpers", () => {
    expect(aggregateDataStatus([])).toBe("DATA_UNAVAILABLE");
    expect(aggregateDataStatus(["LIVE", "LIVE"])).toBe("LIVE");
    expect(aggregateDataStatus(["LIVE", "STALE"])).toBe("MIXED");
    expect(
      aggregateDataStatus(["UNAVAILABLE", "DATA_UNAVAILABLE"]),
    ).toBe("DATA_UNAVAILABLE");
  });
});
