import { describe, expect, it } from "vitest";
import { MockMarketDataProvider } from "./mock-provider";
import type { MarketDataProvider } from "./provider";
import { candleSchema, quoteSchema, volumeSchema } from "./schemas";

describe("MockMarketDataProvider", () => {
  const provider: MarketDataProvider = new MockMarketDataProvider(
    new Date("2026-08-24T12:00:00.000Z"),
  );

  it("implements the MarketDataProvider contract", async () => {
    expect(provider.id).toBe("mock");
    expect(provider.isMock).toBe(true);

    const quote = await provider.getQuote("NVDA");
    const candles = await provider.getCandles("NVDA", {
      timeframe: "1day",
      outputSize: 5,
    });
    const history = await provider.getHistoricalPrices("NVDA", {
      timeframe: "1day",
      outputSize: 5,
    });
    const volume = await provider.getVolume("NVDA");
    const overview = await provider.getMarketOverview(["NVDA", "SPY"]);

    expect(quoteSchema.parse(quote).isMock).toBe(true);
    expect(quote.source).toBe("mock");
    expect(candles).toHaveLength(5);
    expect(history).toHaveLength(5);
    expect(volumeSchema.parse(volume).isMock).toBe(true);
    expect(overview.isMock).toBe(true);
    expect(overview.items).toHaveLength(2);
    candles.forEach((candle) => candleSchema.parse(candle));
  });

  it("returns deterministic quotes for the same symbol", async () => {
    const first = await provider.getQuote("SPY");
    const second = await provider.getQuote("spy");
    expect(first.price).toBe(second.price);
    expect(first.symbol).toBe("SPY");
  });

  it("does not invent live provenance", async () => {
    const quote = await provider.getQuote("BTC/USD");
    expect(quote.source).not.toBe("twelve-data");
    expect(quote.isMock).toBe(true);
  });
});
