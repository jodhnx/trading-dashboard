import { beforeEach, describe, expect, it, vi } from "vitest";
import { runBacktest, httpStatusForBacktestError } from "./service";

vi.mock("server-only", () => ({}));

const getOrCreateAccountSettings = vi.fn();
vi.mock("@/lib/settings/service", () => ({
  getOrCreateAccountSettings: (...args: unknown[]) =>
    getOrCreateAccountSettings(...args),
}));

const getHistoricalCandles = vi.fn();
vi.mock("./twelve-data-historical-provider", () => ({
  createHistoricalDataProvider: () => ({
    getHistoricalCandles: (...args: unknown[]) => getHistoricalCandles(...args),
  }),
}));

function makeCandles(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    timestamp: new Date(Date.UTC(2024, 0, index + 1)),
    open: 100 + index * 0.1,
    high: 101 + index * 0.1,
    low: 99 + index * 0.1,
    close: 100.5 + index * 0.1,
    volume: 1000,
  }));
}

describe("backtest service", () => {
  beforeEach(() => {
    getOrCreateAccountSettings.mockReset();
    getHistoricalCandles.mockReset();
    getOrCreateAccountSettings.mockResolvedValue({
      riskPerTradePercent: 0.5,
      maxPositionPercent: 20,
      minimumRiskReward: 2,
    });
  });

  it("rejects unknown asset", async () => {
    const result = await runBacktest({
      userId: "user-1",
      email: "test@example.com",
      body: {
        symbol: "UNKNOWN",
        timeframe: "1day",
        from: "2024-01-01",
        to: "2024-06-01",
        startingCapital: 10000,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ASSET_NOT_FOUND");
      expect(httpStatusForBacktestError(result.code)).toBe(404);
    }
  });

  it("rejects insufficient candle data", async () => {
    getHistoricalCandles.mockResolvedValue({
      candles: makeCandles(50),
      dataStatus: "LIVE",
      source: "mock",
      isMock: true,
    });
    const result = await runBacktest({
      userId: "user-1",
      email: "test@example.com",
      body: {
        symbol: "NVDA",
        timeframe: "1day",
        from: "2024-01-01",
        to: "2024-06-01",
        startingCapital: 10000,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INSUFFICIENT_DATA");
    }
  });

  it("runs backtest with enough mock candles", async () => {
    getHistoricalCandles.mockResolvedValue({
      candles: makeCandles(250),
      dataStatus: "MOCK",
      source: "mock",
      isMock: true,
    });
    const result = await runBacktest({
      userId: "user-1",
      email: "test@example.com",
      body: {
        symbol: "NVDA",
        timeframe: "1day",
        from: "2024-01-01",
        to: "2024-08-01",
        startingCapital: 10000,
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dataStatus).toBe("MOCK");
      expect(result.data.symbol).toBe("NVDA");
    }
  });

  it("rejects USD without provider mapping", async () => {
    const result = await runBacktest({
      userId: "user-1",
      email: "test@example.com",
      body: {
        symbol: "USD",
        timeframe: "1day",
        from: "2024-01-01",
        to: "2024-06-01",
        startingCapital: 10000,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ASSET_NOT_FOUND");
    }
  });
});
