import { describe, expect, it } from "vitest";
import { boardFromStored } from "./board-from-stored";
import { buildTradingSetup } from "@/engine/trading/setup";
import { emptyTechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import { isProductionEnv, resolveMarketProvider } from "@/lib/env/resolve";
import type { RankedOpportunity } from "./types";

function baseStoredRow(
  overrides: Partial<RankedOpportunity>,
): RankedOpportunity {
  return {
    symbol: "TEST",
    name: "Test",
    assetClass: "STOCK",
    direction: "LONG",
    tier: "STRONG_OPPORTUNITY",
    quality: "NO_TRADE",
    technicalConfirmation: "STRONG",
    tradeStatus: "NO_TRADE",
    blockReason: null,
    setupType: "NO_SETUP",
    holdingHorizon: "SWING",
    currentPrice: 100,
    atr14: 2,
    engineScore: 80,
    entry: 100,
    entryZoneLow: 99,
    entryZoneHigh: 101,
    maxChase: 102,
    stopLoss: 95,
    takeProfit1: 110,
    takeProfit2: 120,
    invalidation: 95,
    riskReward: 2,
    positionSize: 10,
    riskAmount: 50,
    scores: {
      technicalScore: 80,
      momentumScore: 70,
      volumeScore: 60,
      newsScore: 50,
      catalystScore: 50,
      sentimentScore: 50,
      marketRegimeScore: 50,
      riskRewardScore: 70,
      multiTimeFrameScore: 50,
      multiTimeframeScore: 50,
      riskScore: 50,
      dataQualityScore: 80,
      opportunityScore: 75,
      weights: {
        technical: 20,
        momentum: 15,
        volume: 10,
        news: 15,
        catalyst: 10,
        sentiment: 5,
        marketRegime: 5,
        riskReward: 10,
        multiTimeFrame: 10,
      },
    },
    marketRegime: "UNKNOWN",
    dataStatus: "LIVE",
    dataFreshness: "LIVE",
    confidence: 75,
    thesis: "test",
    mtf: {
      daily: {
        timeframe: "1day",
        available: true,
        dataStatus: "LIVE",
        trend: "BULLISH",
        momentum: "BULLISH",
        ema20: null,
        ema50: null,
        ema200: null,
        macd: null,
        macdSignal: null,
        macdHistogram: null,
        atr14: null,
        timestamp: null,
        reason: null,
      },
      setup: {
        timeframe: "4h",
        available: false,
        dataStatus: "UNAVAILABLE",
        trend: "UNKNOWN",
        momentum: "UNKNOWN",
        ema20: null,
        ema50: null,
        ema200: null,
        macd: null,
        macdSignal: null,
        macdHistogram: null,
        atr14: null,
        timestamp: null,
        reason: "not_enriched",
      },
      entry: {
        timeframe: "1h",
        available: false,
        dataStatus: "UNAVAILABLE",
        trend: "UNKNOWN",
        momentum: "UNKNOWN",
        ema20: null,
        ema50: null,
        ema200: null,
        macd: null,
        macdSignal: null,
        macdHistogram: null,
        atr14: null,
        timestamp: null,
        reason: "not_enriched",
      },
      aligned: false,
      score: 50,
      notes: [],
    },
    reasons: [],
    risks: [],
    waitingFor: [],
    newsHeadlines: [],
    newsItems: [],
    confirmation: null,
    scannedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("production audit regressions", () => {
  it("does not promote legacy tier rows to ELIGIBLE bestStock", () => {
    const row = baseStoredRow({
      symbol: "CRM",
      tier: "STRONG_OPPORTUNITY",
      quality: "NO_TRADE",
      tradeStatus: "NO_TRADE",
    });
    const board = boardFromStored([row]);
    expect(board.bestStock).toBeNull();
    expect(board.topStocks.some((item) => item.tradeStatus === "ELIGIBLE")).toBe(
      false,
    );
  });

  it("treats VERCEL_ENV=production as production for mock rejection", () => {
    expect(isProductionEnv({ VERCEL_ENV: "production" })).toBe(true);
    expect(() =>
      resolveMarketProvider({
        MARKET_DATA_PROVIDER: "mock",
        VERCEL_ENV: "production",
      }),
    ).toThrow(/not allowed in production/);
  });

  it("does not leak currentPrice as entry on invalid risk levels", () => {
    const snapshot: TechnicalSnapshot = {
      ...emptyTechnicalSnapshot("AAPL", "1day", "LIVE", null),
      currentPrice: 100,
      previousClose: 98,
      ema20: 99,
      ema50: 95,
      ema200: 90,
      rsi14: 62,
      macd: 1,
      macdSignal: 0.5,
      macdHistogram: 0.5,
      atr14: 5,
      trend: "BULLISH",
      momentum: "POSITIVE",
      volatility: "NORMAL",
      volumeTrend: "INCREASING",
      volumeRatio: 1.2,
      supportLevels: [],
      resistanceLevels: [{ price: 102, strength: 3, touches: 3 }],
    };
    const setup = buildTradingSetup({
      snapshot,
      settings: {
        accountCapital: 10000,
        maxRiskPercent: 0.01,
        maxPositionPercent: 0.2,
        minimumRiskReward: 2,
      },
      atrMultiplier: 1,
    });

    expect(setup.status).toBe("INVALID");
    expect(setup.rejectReasons).toContain("INVALID_RR");
    expect(setup.entry).toBeNull();
  });
});
