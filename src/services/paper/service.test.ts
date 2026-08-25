import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getQuote = vi.fn();
const getTechnicalSnapshot = vi.fn();
const getOrCreateAccountSettings = vi.fn();
const getOrCreatePaperAccount = vi.fn();
const findAssetBySymbol = vi.fn();
const findDuplicateOpenPosition = vi.fn();
const insertOpenPosition = vi.fn();
const insertOpenTrade = vi.fn();
const updatePaperAccountCash = vi.fn();
const findOpenPositionById = vi.fn();
const closePositionRow = vi.fn();
const closeTradeRow = vi.fn();
const listOpenPositions = vi.fn();
const listClosedTrades = vi.fn();
const sumRealizedPnL = vi.fn();

vi.mock("@/services/market/create-service", () => ({
  createMarketDataService: () => ({ getQuote, getTechnicalSnapshot }),
}));

vi.mock("@/lib/settings/service", () => ({
  getOrCreateAccountSettings: (...args: unknown[]) =>
    getOrCreateAccountSettings(...args),
}));

vi.mock("./persistence", () => ({
  getOrCreatePaperAccount: (...args: unknown[]) => getOrCreatePaperAccount(...args),
  findAssetBySymbol: (...args: unknown[]) => findAssetBySymbol(...args),
  findDuplicateOpenPosition: (...args: unknown[]) => findDuplicateOpenPosition(...args),
  insertOpenPosition: (...args: unknown[]) => insertOpenPosition(...args),
  insertOpenTrade: (...args: unknown[]) => insertOpenTrade(...args),
  updatePaperAccountCash: (...args: unknown[]) => updatePaperAccountCash(...args),
  findOpenPositionById: (...args: unknown[]) => findOpenPositionById(...args),
  closePositionRow: (...args: unknown[]) => closePositionRow(...args),
  closeTradeRow: (...args: unknown[]) => closeTradeRow(...args),
  listOpenPositions: (...args: unknown[]) => listOpenPositions(...args),
  listClosedTrades: (...args: unknown[]) => listClosedTrades(...args),
  sumRealizedPnL: (...args: unknown[]) => sumRealizedPnL(...args),
}));

import { closePaperPosition, openPaperTrade } from "./service";
import { buildTradingSetup } from "@/engine/trading/setup";
import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";

function liveSnapshot(): TechnicalSnapshot {
  return {
    symbol: "NVDA",
    timeframe: "1day",
    asOf: new Date("2026-08-25T12:00:00.000Z"),
    currentPrice: 212,
    previousClose: 210,
    change: 2,
    changePercent: 0.95,
    high: 213,
    low: 208,
    volume: 1_000_000,
    ema20: 210,
    ema50: 205,
    ema200: 190,
    rsi14: 58,
    macd: 1.2,
    macdSignal: 0.8,
    macdHistogram: 0.4,
    atr14: 5,
    currentVolume: 100_000,
    averageVolume20: 90_000,
    volumeRatio: 1.1,
    trend: "BULLISH",
    momentum: "POSITIVE",
    volatility: "NORMAL",
    technicalCondition: "FAVORABLE",
    dataStatus: "LIVE",
    dataError: null,
    supportLevels: [],
    resistanceLevels: [],
    volumeTrend: "INCREASING",
  };
}

describe("paper service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrCreateAccountSettings.mockResolvedValue({
      riskPerTradePercent: 0.5,
      maxPositionPercent: 20,
      minimumRiskReward: 2,
    });
    getOrCreatePaperAccount.mockResolvedValue({
      id: "acct-1",
      user_id: "user-1",
      starting_balance: 10000,
      cash_balance: 10000,
      created_at: "2026-08-25T00:00:00.000Z",
      updated_at: "2026-08-25T00:00:00.000Z",
    });
    findAssetBySymbol.mockResolvedValue({
      id: "asset-nvda",
      symbol: "NVDA",
      name: "NVIDIA",
    });
    listOpenPositions.mockResolvedValue([]);
    listClosedTrades.mockResolvedValue([]);
    sumRealizedPnL.mockResolvedValue(0);
  });

  it("rejects invalid trading setup", async () => {
    getTechnicalSnapshot.mockResolvedValue({
      snapshot: { ...liveSnapshot(), trend: "NEUTRAL", momentum: "NEUTRAL" },
      candles: [],
      source: "twelve-data",
    });
    getQuote.mockResolvedValue({
      symbol: "NVDA",
      name: "NVIDIA",
      status: "LIVE",
      source: "twelve-data",
      quote: { price: 212, dataTimestamp: new Date() },
    });

    const result = await openPaperTrade({
      userId: "user-1",
      body: { symbol: "NVDA", timeframe: "1day" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_TRADING_SETUP");
    }
    expect(insertOpenPosition).not.toHaveBeenCalled();
  });

  it("rejects duplicate open positions", async () => {
    const snapshot = liveSnapshot();
    getTechnicalSnapshot.mockResolvedValue({
      snapshot,
      candles: [],
      source: "twelve-data",
    });
    getQuote.mockResolvedValue({
      symbol: "NVDA",
      name: "NVIDIA",
      status: "LIVE",
      source: "twelve-data",
      quote: { price: 212, dataTimestamp: new Date() },
    });
    findDuplicateOpenPosition.mockResolvedValue({ id: "existing" });

    const result = await openPaperTrade({
      userId: "user-1",
      body: { symbol: "NVDA", timeframe: "1day" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("DUPLICATE_OPEN_POSITION");
    }
  });

  it("blocks close for foreign positions", async () => {
    findOpenPositionById.mockResolvedValue(null);
    const result = await closePaperPosition({
      userId: "user-1",
      positionId: "foreign",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NOT_FOUND");
    }
  });

  it("uses trading engine values without client overrides", () => {
    const setup = buildTradingSetup({
      snapshot: liveSnapshot(),
      settings: {
        accountCapital: 10000,
        maxRiskPercent: 0.005,
        maxPositionPercent: 0.2,
        minimumRiskReward: 2,
      },
    });
    expect(setup.entry).not.toBeNull();
    expect(setup.stopLoss).not.toBeNull();
    expect(setup.takeProfit).not.toBeNull();
    expect(setup.positionSize).not.toBeNull();
  });
});
