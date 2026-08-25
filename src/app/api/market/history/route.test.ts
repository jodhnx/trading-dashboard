import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CandleResult } from "@/services/market/provider";

const getAuthUser = vi.fn();
const getCandles = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: () => getAuthUser(),
}));

vi.mock("@/services/market/create-service", () => ({
  createMarketDataService: () => ({ getCandles }),
}));

import { GET } from "./route";

function historyRequest(query: Record<string, string>) {
  const url = new URL("http://localhost/api/market/history");
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

describe("GET /api/market/history", () => {
  beforeEach(() => {
    getAuthUser.mockReset();
    getCandles.mockReset();
  });

  it("returns 401 without a session", async () => {
    getAuthUser.mockResolvedValue(null);
    const response = await GET(
      historyRequest({ symbol: "NVDA", timeframe: "1day", limit: "10" }),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
    expect(getCandles).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid timeframe", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    const response = await GET(
      historyRequest({ symbol: "NVDA", timeframe: "3day", limit: "10" }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_INPUT",
      error: "Invalid timeframe",
    });
    expect(getCandles).not.toHaveBeenCalled();
  });

  it("returns 400 when the limit is too large", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    const response = await GET(
      historyRequest({ symbol: "NVDA", timeframe: "1day", limit: "5000" }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(getCandles).not.toHaveBeenCalled();
  });

  it("returns candles when the provider succeeds", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    const candles: CandleResult = {
      symbol: "NVDA",
      timeframe: "1day",
      status: "LIVE",
      source: "twelve-data",
      candles: [
        {
          symbol: "NVDA",
          timestamp: new Date("2026-08-24T00:00:00.000Z"),
          open: 100,
          high: 110,
          low: 99,
          close: 105,
          volume: 1_000,
          timeframe: "1day",
          source: "twelve-data",
          isMock: false,
        },
      ],
    };
    getCandles.mockResolvedValue(candles);

    const response = await GET(
      historyRequest({ symbol: "nvda", timeframe: "1day", limit: "200" }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.candles).toHaveLength(1);
    expect(body.result.candles[0].close).toBe(105);
    expect(getCandles).toHaveBeenCalledWith("NVDA", "1day", 200);
  });
});
