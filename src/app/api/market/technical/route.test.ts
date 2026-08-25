import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { TechnicalSnapshotResult } from "@/services/market/market-data-service";
import { emptyTechnicalSnapshot } from "@/engine/technical/technical-snapshot";

const getAuthUser = vi.fn();
const getTechnicalSnapshot = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: () => getAuthUser(),
}));

vi.mock("@/services/market/create-service", () => ({
  createMarketDataService: () => ({ getTechnicalSnapshot }),
}));

import { GET } from "./route";

function technicalRequest(query: Record<string, string>) {
  const url = new URL("http://localhost/api/market/technical");
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

describe("GET /api/market/technical", () => {
  beforeEach(() => {
    getAuthUser.mockReset();
    getTechnicalSnapshot.mockReset();
  });

  it("returns 401 without a session", async () => {
    getAuthUser.mockResolvedValue(null);
    const response = await GET(
      technicalRequest({ symbol: "NVDA", timeframe: "1day" }),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
    expect(getTechnicalSnapshot).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid symbol", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    const response = await GET(
      technicalRequest({ symbol: "bad symbol", timeframe: "1day" }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_SYMBOL",
    });
    expect(getTechnicalSnapshot).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid timeframe", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    const response = await GET(
      technicalRequest({ symbol: "NVDA", timeframe: "3day" }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_TIMEFRAME",
    });
    expect(getTechnicalSnapshot).not.toHaveBeenCalled();
  });

  it("returns 503 when market data is unavailable", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    const result: TechnicalSnapshotResult = {
      snapshot: emptyTechnicalSnapshot("NVDA", "1day"),
      candles: [],
      source: null,
    };
    getTechnicalSnapshot.mockResolvedValue(result);

    const response = await GET(
      technicalRequest({ symbol: "NVDA", timeframe: "1day" }),
    );
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe("DATA_UNAVAILABLE");
    expect(body.snapshot.dataStatus).toBe("UNAVAILABLE");
  });

  it("returns a snapshot for an authenticated request", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    const snapshot = emptyTechnicalSnapshot("NVDA", "1day", "LIVE", null);
    snapshot.currentPrice = 120.5;
    snapshot.ema20 = 118.25;
    snapshot.rsi14 = 62.12;
    snapshot.asOf = new Date("2026-08-24T00:00:00.000Z");
    snapshot.dataError = null;
    const result: TechnicalSnapshotResult = {
      snapshot,
      candles: [],
      source: "twelve-data",
    };
    getTechnicalSnapshot.mockResolvedValue(result);

    const response = await GET(
      technicalRequest({ symbol: "nvda", timeframe: "1day" }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.snapshot.symbol).toBe("NVDA");
    expect(body.snapshot.ema20).toBe(118.25);
    expect(body.snapshot.rsi14).toBe(62.12);
    expect(body.snapshot.asOf).toBe("2026-08-24T00:00:00.000Z");
    expect(body.snapshot.dataStatus).toBe("LIVE");
    expect(JSON.stringify(body)).not.toMatch(/BUY|SELL|OPENAI/i);
    expect(getTechnicalSnapshot).toHaveBeenCalledWith("NVDA", "1day");
  });
});
