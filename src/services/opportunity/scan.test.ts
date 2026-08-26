import { describe, expect, it, vi, beforeEach } from "vitest";
import { liveSnapshot } from "@/ai/test-fixtures";
import { emptyTechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import { OPPORTUNITY_UNIVERSE } from "./universe";

vi.mock("server-only", () => ({}));

const getOrCreateAccountSettings = vi.fn();
const getTechnicalSnapshot = vi.fn();
const listNews = vi.fn();

vi.mock("@/lib/settings/service", () => ({
  getOrCreateAccountSettings: (...args: unknown[]) =>
    getOrCreateAccountSettings(...args),
}));

vi.mock("@/services/market/create-service", () => ({
  createMarketDataService: () => ({ getTechnicalSnapshot }),
}));

vi.mock("@/services/news/create-service", () => ({
  createNewsService: () => ({ listNews }),
}));

import { scanDailyOpportunities } from "./scan";

function bullishLive(symbol: string) {
  return {
    snapshot: liveSnapshot({
      symbol,
      dataStatus: "LIVE",
      currentPrice: 100,
      ema20: 99,
      ema50: 97,
      ema200: 90,
      rsi14: 62,
      macd: 1.2,
      macdSignal: 0.8,
      macdHistogram: 0.4,
      atr14: 2.5,
      trend: "BULLISH",
      momentum: "POSITIVE",
      volatility: "NORMAL",
      volumeTrend: "INCREASING",
      currentVolume: 2_000_000,
      averageVolume20: 1_000_000,
      volumeRatio: 2,
    }),
    candles: [],
    source: "test",
  };
}

function unavailable(symbol: string) {
  return {
    snapshot: emptyTechnicalSnapshot(symbol, "1day", "UNAVAILABLE", "DATA_UNAVAILABLE"),
    candles: [],
    source: null,
  };
}

describe("scanDailyOpportunities", () => {
  beforeEach(() => {
    getOrCreateAccountSettings.mockReset();
    getTechnicalSnapshot.mockReset();
    listNews.mockReset();
    getOrCreateAccountSettings.mockResolvedValue({
      displayName: "Test",
      email: null,
      baseCurrency: "USD",
      capital: 10_000,
      riskPerTradePercent: 1,
      maxDailyRiskPercent: 3,
      maxPositionPercent: 20,
      minimumRiskReward: 2,
      minimumAiScore: 6,
      maxOpenPositions: 5,
      tradingStyle: "SWING",
      preferredMarkets: ["US_EQUITIES"],
      preferredAssets: [],
    });
    listNews.mockResolvedValue({ items: [] });
  });

  it("lets LIVE assets reach scoring and can produce ranked opportunities", async () => {
    getTechnicalSnapshot.mockImplementation(async (symbol: string) => {
      if (symbol === "SPY" || symbol === "QQQ" || symbol === "NVDA") {
        return bullishLive(symbol);
      }
      return unavailable(symbol);
    });

    const summary = await scanDailyOpportunities({
      userId: "user-1",
      email: null,
      now: new Date("2026-08-26T14:00:00.000Z"),
      persistence: "admin",
    });

    expect(summary.scanned).toBe(OPPORTUNITY_UNIVERSE.length);
    expect(summary.liveOrCached).toBeGreaterThanOrEqual(3);
    expect(summary.marketRegime).toBe("BULL");
    expect(summary.diagnostics.some((d) => d.symbol === "SPY")).toBe(true);
    expect(summary.diagnostics.find((d) => d.symbol === "SPY")?.dataStatus).toBe(
      "LIVE",
    );
    expect(summary.topStocks.length + summary.watch).toBeGreaterThan(0);
    expect(summary.boardState).toBe("OPPORTUNITIES_AVAILABLE");
    expect(summary.noHighConfidence).toBe(false);
  });

  it("handles UNKNOWN regime without emptying a LIVE board", async () => {
    getTechnicalSnapshot.mockImplementation(async (symbol: string) => {
      if (symbol === "AAPL") {
        return {
          snapshot: liveSnapshot({
            symbol: "AAPL",
            dataStatus: "LIVE",
            trend: "UNKNOWN",
            momentum: "NEUTRAL",
            currentPrice: 100,
            ema20: 100,
            ema50: 100,
            ema200: 100,
            rsi14: 50,
            macd: 0,
            macdSignal: 0,
            macdHistogram: 0,
            atr14: 2,
          }),
          candles: [],
          source: "test",
        };
      }
      return unavailable(symbol);
    });

    const summary = await scanDailyOpportunities({
      userId: "user-1",
      email: null,
      now: new Date("2026-08-26T14:00:00.000Z"),
      persistence: "admin",
    });

    expect(summary.marketRegime).toBe("UNKNOWN");
    expect(summary.liveOrCached).toBe(1);
    expect(summary.diagnostics.some((d) => d.symbol === "AAPL")).toBe(true);
    // UNKNOWN regime must not masquerade as empty-data failure when LIVE exists
    expect(summary.boardState).not.toBe("DATA_INSUFFICIENT");
  });

  it("never invents opportunities from UNAVAILABLE assets", async () => {
    getTechnicalSnapshot.mockImplementation(async (symbol: string) =>
      unavailable(symbol),
    );

    const summary = await scanDailyOpportunities({
      userId: "user-1",
      email: null,
      now: new Date("2026-08-26T14:00:00.000Z"),
      persistence: "admin",
    });

    expect(summary.liveOrCached).toBe(0);
    expect(summary.topStocks).toEqual([]);
    expect(summary.topCrypto).toEqual([]);
    expect(summary.watch).toBe(0);
    expect(summary.boardState).toBe("DATA_INSUFFICIENT");
    expect(summary.diagnostics).toEqual([]);
  });

  it("keeps valid market opportunities when news ingestion fails", async () => {
    listNews.mockRejectedValue(new Error("NEWS UNAVAILABLE"));
    getTechnicalSnapshot.mockImplementation(async (symbol: string) => {
      if (symbol === "SPY" || symbol === "QQQ") {
        return bullishLive(symbol);
      }
      return unavailable(symbol);
    });

    const summary = await scanDailyOpportunities({
      userId: "user-1",
      email: null,
      now: new Date("2026-08-26T14:00:00.000Z"),
      persistence: "admin",
    });

    expect(summary.liveOrCached).toBe(2);
    expect(summary.boardState).not.toBe("DATA_INSUFFICIENT");
    expect(
      summary.all.every((item) =>
        item.risks.some((risk) => risk.includes("NEWS UNAVAILABLE")),
      ),
    ).toBe(true);
  });
});
