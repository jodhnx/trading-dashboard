import { describe, expect, it, vi } from "vitest";
import { MemoryCache } from "./cache";
import { MarketDataService } from "./market-data-service";
import { MockMarketDataProvider } from "./mock-provider";
import { resolveDataStatus } from "./status";
import { parseHistoryQuery, parseQuoteSymbol, parseTechnicalQuery } from "./query";
import { normalizeInternalSymbol, quoteMatchesMapping, toProviderSymbol } from "./symbols";
import { DataUnavailableError } from "./errors";
import type { MarketDataProvider, Quote } from "./provider";

describe("symbol mapping", () => {
  it("maps BTC and Gold to Twelve Data symbols", () => {
    expect(normalizeInternalSymbol("btc/usd")).toBe("BTC");
    expect(toProviderSymbol("BTC")).toBe("BTC/USD");
    expect(toProviderSymbol("XAU")).toBe("XAU/USD");
    expect(toProviderSymbol("USD")).toBeNull();
    expect(toProviderSymbol("NVDA")).toBe("NVDA");
    expect(toProviderSymbol("SPY")).toBe("SPY");
    expect(toProviderSymbol("QQQ")).toBe("QQQ");
    expect(toProviderSymbol("BNB")).toBe("BNB/USD");
    expect(toProviderSymbol("DOGE")).toBe("DOGE/USD");
    expect(toProviderSymbol("GOOGL")).toBe("GOOGL");
    expect(toProviderSymbol("DIA")).toBe("DIA");
  });

  it("never treats Dynex Capital as the USD dollar index", () => {
    expect(
      quoteMatchesMapping("USD", { name: "Dynex Capital Inc.", symbol: "DX" }),
    ).toBe(false);
  });
});

describe("query validation", () => {
  it("normalizes quote symbols", () => {
    expect(parseQuoteSymbol("nvda")).toEqual({ ok: true, symbol: "NVDA" });
    expect(parseQuoteSymbol("bad symbol").ok).toBe(false);
  });

  it("rejects invalid history params", () => {
    expect(
      parseHistoryQuery({ symbol: "NVDA", timeframe: "3day", limit: "10" }).ok,
    ).toBe(false);
    expect(
      parseHistoryQuery({ symbol: "NVDA", timeframe: "1day", limit: "5000" }).ok,
    ).toBe(false);
    expect(
      parseHistoryQuery({ symbol: "NVDA", timeframe: "1day", limit: "200" }),
    ).toMatchObject({ ok: true, limit: 200, timeframe: "1day" });
  });

  it("rejects invalid technical query params with explicit codes", () => {
    expect(parseTechnicalQuery({ symbol: "bad symbol", timeframe: "1day" })).toMatchObject({
      ok: false,
      code: "INVALID_SYMBOL",
    });
    expect(parseTechnicalQuery({ symbol: "NVDA", timeframe: "3day" })).toMatchObject({
      ok: false,
      code: "INVALID_TIMEFRAME",
    });
    expect(parseTechnicalQuery({ symbol: "nvda", timeframe: "4h" })).toEqual({
      ok: true,
      symbol: "NVDA",
      timeframe: "4h",
    });
  });
});

describe("cache", () => {
  it("returns values only before TTL expiry", () => {
    let now = 1_000;
    const cache = new MemoryCache<string>(() => now);
    cache.set("q", "live", 30);
    expect(cache.get("q")).toBe("live");
    now = 1_040;
    expect(cache.get("q")).toBeUndefined();
  });
});

describe("stale detection", () => {
  it("marks an open-session quote STALE when the last tick is too old", () => {
    const now = new Date("2026-08-24T15:00:00.000Z");
    expect(
      resolveDataStatus({
        hasData: true,
        isMock: false,
        origin: "provider",
        dataTimestamp: new Date("2026-08-24T14:00:00.000Z"),
        now,
        isMarketOpen: true,
        sessionKind: "us_equity",
      }),
    ).toBe("STALE");
  });

  it("keeps the last official equity print as CACHED after the session closes", () => {
    expect(
      resolveDataStatus({
        hasData: true,
        isMock: false,
        origin: "provider",
        dataTimestamp: new Date("2026-08-24T20:00:00.000Z"),
        now: new Date("2026-08-24T22:30:00.000Z"),
        isMarketOpen: false,
        sessionKind: "us_equity",
      }),
    ).toBe("CACHED");
  });

  it("treats crypto as 24/7 and marks a 20-minute-old tick STALE", () => {
    const now = new Date("2026-08-24T16:20:00.000Z");
    expect(
      resolveDataStatus({
        hasData: true,
        isMock: false,
        origin: "provider",
        dataTimestamp: new Date("2026-08-24T16:00:00.000Z"),
        now,
        isMarketOpen: true,
        sessionKind: "crypto",
      }),
    ).toBe("STALE");
  });

  it("still labels mock quotes as MOCK", () => {
    const now = new Date("2026-08-24T15:00:00.000Z");
    expect(
      resolveDataStatus({
        hasData: true,
        isMock: true,
        origin: "provider",
        dataTimestamp: now,
        now,
        isMarketOpen: true,
        sessionKind: "us_equity",
      }),
    ).toBe("MOCK");
  });
});

describe("MarketDataService", () => {
  it("normalizes provider quotes and serves cache on the second call", async () => {
    const provider = new MockMarketDataProvider(
      new Date("2026-08-24T12:00:00.000Z"),
    );
    const service = new MarketDataService(
      provider,
      new MemoryCache<Quote>(),
      new MemoryCache(),
      null,
      () => new Date("2026-08-24T12:00:00.000Z"),
    );

    const first = await service.getQuote("NVDA");
    const second = await service.getQuote("NVDA");
    expect(first.quote?.price).toBe(second.quote?.price);
    expect(first.status).toBe("MOCK");
    expect(second.status).toBe("MOCK");
    expect(second.source).toBe("mock");
  });

  it("falls back to stored data instead of inventing prices", async () => {
    const failing: MarketDataProvider = {
      id: "twelve-data",
      isMock: false,
      async getQuote() {
        throw new DataUnavailableError("DATA UNAVAILABLE", { reason: "api_error" });
      },
      async getHistoricalPrices() {
        return [];
      },
      async getCandles() {
        throw new DataUnavailableError("DATA UNAVAILABLE");
      },
      async getVolume() {
        throw new DataUnavailableError("DATA UNAVAILABLE");
      },
      async getMarketOverview() {
        return { asOf: new Date(), source: "twelve-data", isMock: false, items: [] };
      },
    };

    const stored: Quote = {
      symbol: "NVDA",
      name: "NVIDIA",
      exchange: "NASDAQ",
      currency: "USD",
      price: 120,
      change: 1,
      changePercent: 0.8,
      open: 119,
      high: 121,
      low: 118,
      previousClose: 119,
      volume: 1000,
      timestamp: new Date("2026-08-24T10:00:00.000Z"),
      dataTimestamp: new Date("2026-08-24T10:00:00.000Z"),
      isMarketOpen: null,
      source: "supabase",
      isMock: false,
    };

    const service = new MarketDataService(
      failing,
      new MemoryCache<Quote>(),
      new MemoryCache(),
      {
        persistQuote: async () => undefined,
        persistCandles: async () => undefined,
        loadLatestQuote: async () => stored,
        loadCandles: async () => null,
      },
      () => new Date("2026-08-24T15:00:00.000Z"),
    );

    const result = await service.getQuote("NVDA");
    expect(result.quote?.price).toBe(120);
    expect(result.status).toBe("STALE");
    expect(result.source).toBe("supabase");
  });

  it("persists a live quote instead of inventing a replacement", async () => {
    const persistQuote = vi.fn(async () => undefined);
    const timestamp = new Date("2026-08-24T12:00:00.000Z");
    const live: MarketDataProvider = {
      id: "twelve-data",
      isMock: false,
      async getQuote() {
        return {
          symbol: "NVDA",
          name: "NVIDIA",
          exchange: "NASDAQ",
          currency: "USD",
          price: 120,
          change: 1,
          changePercent: 0.8,
          open: 119,
          high: 121,
          low: 118,
          previousClose: 119,
          volume: 1000,
          timestamp,
          dataTimestamp: timestamp,
          isMarketOpen: true,
          source: "twelve-data",
          isMock: false,
        };
      },
      async getHistoricalPrices() {
        return [];
      },
      async getCandles() {
        return [];
      },
      async getVolume() {
        throw new DataUnavailableError("DATA UNAVAILABLE");
      },
      async getMarketOverview() {
        return { asOf: timestamp, source: "twelve-data", isMock: false, items: [] };
      },
    };

    const service = new MarketDataService(
      live,
      new MemoryCache<Quote>(),
      new MemoryCache(),
      {
        persistQuote,
        persistCandles: async () => undefined,
        loadLatestQuote: async () => null,
        loadCandles: async () => null,
      },
      () => timestamp,
    );

    const result = await service.getQuote("NVDA");
    expect(result.status).toBe("LIVE");
    expect(persistQuote).toHaveBeenCalledWith(
      "NVDA",
      expect.objectContaining({
        symbol: "NVDA",
        price: 120,
        isMock: false,
      }),
    );
  });

  it("returns UNAVAILABLE for USD without calling the provider", async () => {
    const getQuote = vi.fn(async () => {
      throw new Error("USD must not be sent to Twelve Data");
    });
    const provider = {
      id: "twelve-data",
      isMock: false,
      getQuote,
      async getHistoricalPrices() {
        return [];
      },
      async getCandles() {
        return [];
      },
      async getVolume() {
        throw new DataUnavailableError("DATA UNAVAILABLE");
      },
      async getMarketOverview() {
        return { asOf: new Date(), source: "twelve-data", isMock: false, items: [] };
      },
    } satisfies MarketDataProvider;

    const service = new MarketDataService(
      provider,
      new MemoryCache<Quote>(),
      new MemoryCache(),
    );
    const result = await service.getQuote("USD");
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.quote).toBeNull();
    expect(result.name).toBe("US Dollar");
    expect(JSON.stringify(result)).not.toMatch(/Dynex/i);
    expect(getQuote).not.toHaveBeenCalled();
  });

  it("returns UNAVAILABLE when no provider and no cache exist", async () => {
    const service = new MarketDataService(
      null,
      new MemoryCache<Quote>(),
      new MemoryCache(),
    );
    const result = await service.getQuote("NVDA");
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.quote).toBeNull();
  });

  it("computes a MOCK technical snapshot from mock candles without labeling it LIVE", async () => {
    const provider = new MockMarketDataProvider(
      new Date("2026-08-24T12:00:00.000Z"),
    );
    const service = new MarketDataService(
      provider,
      new MemoryCache<Quote>(),
      new MemoryCache(),
      null,
      () => new Date("2026-08-24T12:00:00.000Z"),
    );
    const result = await service.getTechnicalSnapshot("NVDA", "1day");
    expect(result.snapshot.dataStatus).toBe("MOCK");
    expect(result.snapshot.currentPrice).not.toBeNull();
    expect(result.candles.length).toBeGreaterThan(0);
    expect(["BULLISH", "BEARISH", "NEUTRAL", "UNKNOWN"]).toContain(
      result.snapshot.trend,
    );
  });

  it("returns DATA_UNAVAILABLE for an unmapped technical symbol", async () => {
    const service = new MarketDataService(
      null,
      new MemoryCache<Quote>(),
      new MemoryCache(),
    );
    const result = await service.getTechnicalSnapshot("USD", "1day");
    expect(result.snapshot.dataStatus).toBe("UNAVAILABLE");
    expect(result.snapshot.dataError).toBe("DATA_UNAVAILABLE");
    expect(result.snapshot.ema20).toBeNull();
  });
});
