import { describe, expect, it, vi } from "vitest";
import { DataUnavailableError } from "./errors";
import { TwelveDataProvider } from "./twelve-data-provider";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("TwelveDataProvider", () => {
  it("maps a valid quote without inventing missing fields", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        symbol: "AAPL",
        name: "Apple Inc",
        exchange: "NASDAQ",
        currency: "USD",
        datetime: "2026-08-24 16:00:00",
        open: "220.1",
        high: "221.4",
        low: "219.0",
        close: "220.8",
        volume: "1000",
        previous_close: "218.0",
      }),
    ) as unknown as typeof fetch;

    const provider = new TwelveDataProvider("test-key", fetchFn);
    const quote = await provider.getQuote("AAPL");

    expect(quote.price).toBe(220.8);
    expect(quote.change).toBeCloseTo(2.8);
    expect(quote.isMock).toBe(false);
    expect(quote.source).toBe("twelve-data");
    expect(quote.name).toBe("Apple Inc");
  });

  it("does not send internal USD to Twelve Data", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ symbol: "USD", close: "1", datetime: "2026-08-24 16:00:00" }),
    ) as unknown as typeof fetch;
    const provider = new TwelveDataProvider("test-key", fetchFn);
    await expect(provider.getQuote("USD")).rejects.toMatchObject({
      details: { reason: "unmapped_symbol" },
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("requests BTC/USD rather than the internal BTC code", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain("symbol=BTC%2FUSD");
      return jsonResponse({
        symbol: "BTC/USD",
        datetime: "2026-08-24 16:00:00",
        close: "100",
        previous_close: "99",
      });
    }) as unknown as typeof fetch;
    const provider = new TwelveDataProvider("test-key", fetchFn);
    await provider.getQuote("BTC");
    expect(fetchFn).toHaveBeenCalled();
  });

  it("prefers last_quote_at over a date-only datetime", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        symbol: "NVDA",
        name: "NVIDIA Corporation",
        exchange: "NASDAQ",
        currency: "USD",
        datetime: "2026-08-24",
        timestamp: 1787578200,
        last_quote_at: 1787587320,
        close: "210.06",
        previous_close: "208.00",
        is_market_open: true,
      }),
    ) as unknown as typeof fetch;
    const provider = new TwelveDataProvider("test-key", fetchFn);
    const quote = await provider.getQuote("NVDA");
    expect(quote.dataTimestamp.toISOString()).toBe("2026-08-24T16:02:00.000Z");
    expect(quote.isMarketOpen).toBe(true);
  });

  it("throws when price is missing", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ symbol: "AAPL", datetime: "2026-08-24 16:00:00" }),
    ) as unknown as typeof fetch;
    const provider = new TwelveDataProvider("test-key", fetchFn);
    await expect(provider.getQuote("AAPL")).rejects.toMatchObject({
      details: { reason: "missing_price" },
    });
  });

  it("throws when timestamp is missing", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ symbol: "AAPL", close: "100" }),
    ) as unknown as typeof fetch;
    const provider = new TwelveDataProvider("test-key", fetchFn);
    await expect(provider.getQuote("AAPL")).rejects.toMatchObject({
      details: { reason: "missing_timestamp" },
    });
  });

  it("throws on API error payloads", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ status: "error", message: "Invalid symbol" }),
    ) as unknown as typeof fetch;
    const provider = new TwelveDataProvider("test-key", fetchFn);
    await expect(provider.getQuote("NOPE")).rejects.toMatchObject({
      details: { reason: "invalid_symbol" },
    });
  });

  it("throws on malformed JSON bodies", async () => {
    const fetchFn = vi.fn(async () => new Response("not-json", { status: 200 })) as unknown as typeof fetch;
    const provider = new TwelveDataProvider("test-key", fetchFn);
    await expect(provider.getQuote("AAPL")).rejects.toMatchObject({
      details: { reason: "malformed" },
    });
  });

  it("throws on timeout", async () => {
    const fetchFn = vi.fn(async () => {
      const error = new Error("The operation was aborted due to timeout");
      error.name = "TimeoutError";
      throw error;
    }) as unknown as typeof fetch;
    const provider = new TwelveDataProvider("test-key", fetchFn);
    await expect(provider.getQuote("AAPL")).rejects.toMatchObject({
      details: { reason: "timeout" },
    });
  });

  it("throws on rate limits", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ status: "error", code: 429, message: "run out of API credits" }, 429),
    ) as unknown as typeof fetch;
    const provider = new TwelveDataProvider("test-key", fetchFn);
    await expect(provider.getQuote("AAPL")).rejects.toMatchObject({
      details: { reason: "rate_limit" },
    });
  });

  it("does not invent candles for an invalid symbol error", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ status: "error", message: "Invalid symbol" }),
    ) as unknown as typeof fetch;
    const provider = new TwelveDataProvider("test-key", fetchFn);
    await expect(
      provider.getCandles("ZZZZ", { timeframe: "1day", outputSize: 10 }),
    ).rejects.toBeInstanceOf(DataUnavailableError);
  });
});
