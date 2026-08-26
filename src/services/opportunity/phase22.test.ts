import { describe, expect, it } from "vitest";
import { liveSnapshot } from "@/ai/test-fixtures";
import { emptyTradingSetup, buildTradingSetup } from "@/engine/trading/setup";
import { TEST_SETTINGS, longSetup } from "@/ai/test-fixtures";
import {
  classifySignalQuality,
  freshnessConfidenceFactor,
  toDataFreshness,
} from "./quality";
import { evaluateTradeEligibility } from "./trade-status";
import {
  compareOpportunityRank,
  selectBestOpportunity,
  whyNoBest,
} from "./ranking";
import { scoreMtfAlignment } from "./mtf";
import { computeOpportunityScore } from "./score";
import { scoreSetup } from "@/engine/trading/score";
import type { RankedOpportunity } from "./types";
import { OPPORTUNITY_SCORE_WEIGHTS } from "./types";

function baseRanked(
  overrides: Partial<RankedOpportunity> & Pick<RankedOpportunity, "symbol" | "quality">,
): RankedOpportunity {
  const { symbol, quality, scores, ...rest } = overrides;
  return {
    symbol,
    name: symbol,
    assetClass: "STOCK",
    direction: "LONG",
    tier: "WATCH",
    quality,
    technicalConfirmation:
      quality === "STRONG" || quality === "CONFIRMED" ? "STRONG" : "WATCH",
    tradeStatus:
      quality === "STRONG" || quality === "CONFIRMED" ? "ELIGIBLE" : "NO_TRADE",
    blockReason: null,
    setupType: "TREND_CONTINUATION",
    holdingHorizon: "SWING",
    currentPrice: 100,
    atr14: 2,
    engineScore: 70,
    entry: null,
    entryZoneLow: null,
    entryZoneHigh: null,
    maxChase: null,
    stopLoss: null,
    takeProfit1: null,
    takeProfit2: null,
    invalidation: null,
    riskReward: null,
    positionSize: null,
    riskAmount: null,
    scores: {
      technicalScore: 70,
      momentumScore: 60,
      volumeScore: 50,
      newsScore: 50,
      catalystScore: 50,
      sentimentScore: 50,
      marketRegimeScore: 50,
      riskRewardScore: 50,
      multiTimeFrameScore: 50,
      multiTimeframeScore: 50,
      opportunityScore: 70,
      weights: OPPORTUNITY_SCORE_WEIGHTS,
      ...scores,
    },
    marketRegime: "BULL",
    dataStatus: "LIVE",
    dataFreshness: "LIVE",
    confidence: 70,
    thesis: "test",
    mtf: {
      daily: {
        timeframe: "1day",
        available: true,
        dataStatus: "LIVE",
        trend: "BULLISH",
        momentum: "POSITIVE",
        ema20: 101,
        ema50: 99,
        ema200: 90,
        macd: 1,
        macdSignal: 0.5,
        macdHistogram: 0.5,
        atr14: 2,
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
        reason: "DATA_UNAVAILABLE",
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
        reason: "DATA_UNAVAILABLE",
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
    scannedAt: "2026-08-26T12:00:00.000Z",
    ...rest,
  };
}

describe("phase22 signal quality", () => {
  it("classifies STRONG or CONFIRMED for VALID bullish setup with levels", () => {
    const snapshot = liveSnapshot({
      trend: "BULLISH",
      momentum: "STRONG",
      ema20: 101,
      ema50: 99,
      ema200: 90,
      macdHistogram: 0.5,
      atr14: 2,
      currentPrice: 100,
      dataStatus: "LIVE",
    });
    const built = buildTradingSetup({
      snapshot,
      settings: TEST_SETTINGS,
      now: new Date("2026-08-26T14:00:00.000Z"),
    });
    const quality = classifySignalQuality({
      setup: built,
      snapshot,
      dataFreshness: "LIVE",
      mtfAligned: true,
    });
    if (built.status === "VALID") {
      expect(["STRONG", "CONFIRMED"]).toContain(quality);
      expect(built.entry).not.toBeNull();
      expect(built.stopLoss).not.toBeNull();
      expect(built.takeProfit).not.toBeNull();
    } else {
      expect(quality).not.toBe("STRONG");
    }
  });

  it("classifies EARLY_SETUP for AMD-like bullish trend + EMA without momentum", () => {
    const snapshot = liveSnapshot({
      symbol: "AMD",
      trend: "BULLISH",
      momentum: "NEUTRAL",
      ema20: 101,
      ema50: 99,
      ema200: 90,
      macdHistogram: 0.1,
      atr14: 2,
      currentPrice: 100,
      rsi14: 55,
      dataStatus: "LIVE",
    });
    const setup = emptyTradingSetup(snapshot, TEST_SETTINGS, {
      direction: "NO_TRADE",
      status: "REJECTED",
      score: 73,
    });
    expect(
      classifySignalQuality({
        setup,
        snapshot,
        dataFreshness: "LIVE",
        mtfAligned: false,
      }),
    ).toBe("EARLY_SETUP");
  });

  it("never treats STALE valid setups as CONFIRMED/STRONG quality", () => {
    const setup = longSetup();
    const snapshot = liveSnapshot({ dataStatus: "STALE" });
    expect(
      classifySignalQuality({
        setup,
        snapshot,
        dataFreshness: "STALE",
        mtfAligned: true,
      }),
    ).toBe("NO_TRADE");
    expect(
      evaluateTradeEligibility({
        setup,
        snapshot,
        dataFreshness: "STALE",
      }).tradeStatus,
    ).toBe("BLOCKED");
  });

  it("maps freshness without promoting CACHED to LIVE", () => {
    expect(toDataFreshness("LIVE")).toBe("LIVE");
    expect(toDataFreshness("CACHED")).toBe("CACHED");
    expect(toDataFreshness("STALE")).toBe("STALE");
    expect(toDataFreshness("CACHED", Date.now() - 60_000)).toBe("RECENT");
    expect(freshnessConfidenceFactor("CACHED")).toBeLessThan(1);
    expect(freshnessConfidenceFactor("LIVE")).toBe(1);
  });

  it("marks weak evidence as NO_TRADE", () => {
    const snapshot = liveSnapshot({
      trend: "NEUTRAL",
      momentum: "NEUTRAL",
      ema20: 100,
      ema50: 100,
      ema200: 100,
      macdHistogram: 0,
    });
    const setup = emptyTradingSetup(snapshot, TEST_SETTINGS, {
      direction: "NO_TRADE",
      status: "REJECTED",
    });
    expect(
      classifySignalQuality({
        setup,
        snapshot,
        dataFreshness: "LIVE",
        mtfAligned: false,
      }),
    ).toBe("NO_TRADE");
  });
});

describe("phase22 ranking", () => {
  it("selects bestStock only from CONFIRMED/STRONG — never forces a trade", () => {
    const early = baseRanked({
      symbol: "AMD",
      quality: "EARLY_SETUP",
      scores: {
        ...baseRanked({ symbol: "x", quality: "WATCH" }).scores,
        opportunityScore: 90,
      },
    });
    const watch = baseRanked({ symbol: "IWM", quality: "WATCH" });
    expect(selectBestOpportunity([early, watch])).toBeNull();
    expect(
      whyNoBest({
        assetClass: "STOCK",
        candidates: [early, watch],
        liveOrCached: 2,
      }),
    ).toMatch(/developing/i);
  });

  it("ranks CONFIRMED above EARLY_SETUP above WATCH", () => {
    const a = baseRanked({
      symbol: "AAA",
      quality: "WATCH",
      scores: {
        ...baseRanked({ symbol: "x", quality: "WATCH" }).scores,
        opportunityScore: 99,
      },
    });
    const b = baseRanked({
      symbol: "BBB",
      quality: "EARLY_SETUP",
      scores: {
        ...baseRanked({ symbol: "x", quality: "WATCH" }).scores,
        opportunityScore: 60,
      },
    });
    const c = baseRanked({
      symbol: "CCC",
      quality: "CONFIRMED",
      entry: 100,
      stopLoss: 95,
      takeProfit1: 110,
      takeProfit2: 115,
      riskReward: 2,
      scores: {
        ...baseRanked({ symbol: "x", quality: "WATCH" }).scores,
        opportunityScore: 55,
      },
    });
    const sorted = [a, b, c].sort(compareOpportunityRank);
    expect(sorted.map((s) => s.symbol)).toEqual(["CCC", "BBB", "AAA"]);
    expect(selectBestOpportunity([a, b, c])?.symbol).toBe("CCC");
  });

  it("separates best crypto from stocks", () => {
    const stock = baseRanked({
      symbol: "NVDA",
      quality: "CONFIRMED",
      assetClass: "STOCK",
      entry: 100,
      stopLoss: 95,
      takeProfit1: 110,
      takeProfit2: 115,
      riskReward: 2,
    });
    const crypto = baseRanked({
      symbol: "BTC",
      quality: "STRONG",
      assetClass: "CRYPTO",
      entry: 100,
      stopLoss: 95,
      takeProfit1: 110,
      takeProfit2: 120,
      riskReward: 2.5,
      scores: {
        ...baseRanked({ symbol: "x", quality: "WATCH" }).scores,
        opportunityScore: 88,
      },
    });
    expect(selectBestOpportunity([stock])?.symbol).toBe("NVDA");
    expect(selectBestOpportunity([crypto])?.symbol).toBe("BTC");
    expect(selectBestOpportunity([stock])?.assetClass).not.toBe("CRYPTO");
  });
});

describe("phase22 mtf + score", () => {
  it("scores MTF alignment without fabricating missing frames", () => {
    const daily = liveSnapshot({ trend: "BULLISH", dataStatus: "LIVE" });
    const result = scoreMtfAlignment({
      daily,
      setup: null,
      entry: null,
    });
    expect(result.alignment.setup.available).toBe(false);
    expect(result.alignment.entry.available).toBe(false);
    expect(result.score).toBe(50);
  });

  it("includes multiTimeframe in opportunity score weights", () => {
    const setup = longSetup();
    const scores = computeOpportunityScore({
      technicalBreakdown: scoreSetup(liveSnapshot(), "LONG"),
      setup,
      newsScore: 70,
      catalystScore: 60,
      sentimentScore: 50,
      marketRegime: "BULL",
      multiTimeFrameScore: 80,
    });
    expect(scores.multiTimeFrameScore).toBe(80);
    expect(scores.weights.multiTimeFrame).toBe(10);
    expect(scores.weights.technical).toBe(20);
  });

  it("reduces score for stale freshness factor", () => {
    const setup = longSetup();
    const live = computeOpportunityScore({
      technicalBreakdown: scoreSetup(liveSnapshot(), "LONG"),
      setup,
      newsScore: 50,
      catalystScore: 50,
      sentimentScore: 50,
      marketRegime: "BULL",
      freshnessFactor: 1,
    });
    const stale = computeOpportunityScore({
      technicalBreakdown: scoreSetup(liveSnapshot(), "LONG"),
      setup,
      newsScore: 50,
      catalystScore: 50,
      sentimentScore: 50,
      marketRegime: "BULL",
      freshnessFactor: 0.75,
    });
    expect(stale.opportunityScore).toBeLessThan(live.opportunityScore);
  });
});
