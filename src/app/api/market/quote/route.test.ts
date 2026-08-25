import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { QuoteResult } from "@/services/market/provider";

const getAuthUser = vi.fn();
const getQuote = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: () => getAuthUser(),
}));

vi.mock("@/services/market/create-service", () => ({
  createMarketDataService: () => ({ getQuote }),
}));

import { GET } from "./route";

function quoteRequest(symbol?: string) {
  const url = new URL("http://localhost/api/market/quote");
  if (symbol !== undefined) {
    url.searchParams.set("symbol", symbol);
  }
  return new NextRequest(url);
}

function liveQuote(symbol: string): QuoteResult {
  const timestamp = new Date("2026-08-24T16:00:00.000Z");
  return {
    symbol,
    name: symbol,
    status: "LIVE",
    source: "twelve-data",
    quote: {
      symbol,
      name: symbol,
      exchange: "NASDAQ",
      currency: "USD",
      price: 120.5,
      change: 1.2,
      changePercent: 1.01,
      open: 119,
      high: 121,
      low: 118,
      previousClose: 119.3,
      volume: 1_000_000,
      timestamp,
      dataTimestamp: timestamp,
      isMarketOpen: true,
      source: "twelve-data",
      isMock: false,
    },
  };
}

describe("GET /api/market/quote", () => {
  beforeEach(() => {
    getAuthUser.mockReset();
    getQuote.mockReset();
  });

  it("returns 401 without a session", async () => {
    getAuthUser.mockResolvedValue(null);
    const response = await GET(quoteRequest("NVDA"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
    expect(getQuote).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid symbol", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    const response = await GET(quoteRequest("bad symbol"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(getQuote).not.toHaveBeenCalled();
  });

  it("returns a structured quote when the provider succeeds", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    getQuote.mockResolvedValue(liveQuote("NVDA"));
    const response = await GET(quoteRequest("nvda"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.status).toBe("LIVE");
    expect(body.result.quote.price).toBe(120.5);
    expect(body.result.quote.symbol).toBe("NVDA");
    expect(getQuote).toHaveBeenCalledWith("NVDA");
  });

  it("returns 503 when the provider has no data", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    getQuote.mockResolvedValue({
      symbol: "NVDA",
      name: "NVIDIA",
      status: "UNAVAILABLE",
      source: null,
      quote: null,
    } satisfies QuoteResult);
    const response = await GET(quoteRequest("NVDA"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "DATA_UNAVAILABLE",
    });
  });

  it("returns UNAVAILABLE for USD without a Dynex quote", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    getQuote.mockResolvedValue({
      symbol: "USD",
      name: "US Dollar",
      status: "UNAVAILABLE",
      source: null,
      quote: null,
    } satisfies QuoteResult);
    const response = await GET(quoteRequest("USD"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe("DATA_UNAVAILABLE");
    expect(JSON.stringify(body)).not.toMatch(/Dynex/i);
    expect(body.result.quote).toBeNull();
  });
});
