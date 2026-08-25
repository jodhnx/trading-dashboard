import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { emptyTechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import { emptyTradingSetup } from "@/engine/trading/setup";
import type { TradingRiskSettings } from "@/engine/trading/types";
import type { TechnicalSnapshotResult } from "@/services/market/market-data-service";
import type { AccountSettings } from "@/lib/settings/schema";

const getAuthUser = vi.fn();
const getTechnicalSnapshot = vi.fn();
const getOrCreateAccountSettings = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: () => getAuthUser(),
}));

vi.mock("@/services/market/create-service", () => ({
  createMarketDataService: () => ({ getTechnicalSnapshot }),
}));

vi.mock("@/lib/settings/service", () => ({
  getOrCreateAccountSettings: (...args: unknown[]) =>
    getOrCreateAccountSettings(...args),
}));

import { GET } from "./route";

function setupRequest(query: Record<string, string>) {
  const url = new URL("http://localhost/api/trading/setup");
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

const account: AccountSettings = {
  email: "trader@example.com",
  displayName: "Trader",
  baseCurrency: "EUR",
  capital: 10_000,
  riskPerTradePercent: 1,
  maxDailyRiskPercent: 3,
  maxPositionPercent: 20,
  minimumRiskReward: 2,
  minimumAiScore: 7,
  maxOpenPositions: 5,
  tradingStyle: "SWING",
  preferredMarkets: ["STOCKS"],
  preferredAssets: ["NVDA"],
};

const risk: TradingRiskSettings = {
  accountCapital: 10_000,
  maxRiskPercent: 0.01,
  maxPositionPercent: 0.2,
  minimumRiskReward: 2,
};

describe("GET /api/trading/setup", () => {
  beforeEach(() => {
    getAuthUser.mockReset();
    getTechnicalSnapshot.mockReset();
    getOrCreateAccountSettings.mockReset();
  });

  it("returns 401 without a session", async () => {
    getAuthUser.mockResolvedValue(null);
    const response = await GET(
      setupRequest({ symbol: "NVDA", timeframe: "1day" }),
    );
    expect(response.status).toBe(401);
    expect(getTechnicalSnapshot).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid symbol", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: "a@b.c" });
    const response = await GET(
      setupRequest({ symbol: "bad symbol", timeframe: "1day" }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_SYMBOL",
    });
  });

  it("returns 400 for an invalid timeframe", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: "a@b.c" });
    const response = await GET(
      setupRequest({ symbol: "NVDA", timeframe: "3day" }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_TIMEFRAME",
    });
  });

  it("returns 503 when market data is unavailable", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: "a@b.c" });
    getOrCreateAccountSettings.mockResolvedValue(account);
    const snapshot = emptyTechnicalSnapshot("NVDA", "1day");
    const result: TechnicalSnapshotResult = {
      snapshot,
      candles: [],
      source: null,
    };
    getTechnicalSnapshot.mockResolvedValue(result);

    const response = await GET(
      setupRequest({ symbol: "NVDA", timeframe: "1day" }),
    );
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe("DATA_UNAVAILABLE");
    expect(body.setup.status).toBe("REJECTED");
  });

  it("returns a setup for an authenticated request", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: "a@b.c" });
    getOrCreateAccountSettings.mockResolvedValue(account);
    const snapshot = emptyTechnicalSnapshot("NVDA", "1day", "LIVE", null);
    snapshot.currentPrice = 100;
    snapshot.ema20 = 99;
    snapshot.ema50 = 97;
    snapshot.ema200 = 90;
    snapshot.rsi14 = 60;
    snapshot.macd = 1;
    snapshot.macdSignal = 0.5;
    snapshot.macdHistogram = 0.4;
    snapshot.atr14 = 5;
    snapshot.trend = "BULLISH";
    snapshot.momentum = "POSITIVE";
    snapshot.volatility = "NORMAL";
    snapshot.volumeTrend = "INCREASING";
    getTechnicalSnapshot.mockResolvedValue({
      snapshot,
      candles: [],
      source: "twelve-data",
    } satisfies TechnicalSnapshotResult);

    const response = await GET(
      setupRequest({ symbol: "nvda", timeframe: "1day" }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.setup.symbol).toBe("NVDA");
    expect(body.setup.entry).toBe(100);
    expect(body.setup.score).not.toBeNull();
    expect(body.setup.dataStatus).toBe("LIVE");
    expect(JSON.stringify(body)).not.toMatch(/OPENAI/);
    expect(getTechnicalSnapshot).toHaveBeenCalledWith("NVDA", "1day");
    expect(getOrCreateAccountSettings).toHaveBeenCalled();
  });
});

describe("empty setup helper", () => {
  it("keeps a rejected placeholder without inventing prices", () => {
    const setup = emptyTradingSetup(
      emptyTechnicalSnapshot("BTC", "1day"),
      risk,
    );
    expect(setup.entry).toBeNull();
    expect(setup.direction).toBe("NO_TRADE");
  });
});
