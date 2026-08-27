import { describe, expect, it } from "vitest";
import { RELEASE_PHASE } from "@/lib/release";
import {
  deriveTradeAction,
  isActionableOpportunity,
  tradeActionLabel,
  hasAcceptableFreshness,
} from "./actionable";
import { selectBestOpportunity } from "./ranking";
import { toOpportunityCandidate } from "./present";
import { exitActionLabel } from "@/services/exit/present";
import { evaluateExitState } from "@/services/exit/engine";
import { isPaperTradeableSetup } from "@/services/paper/setup";
import { emptyTradingSetup } from "@/engine/trading/setup";
import { liveSnapshot, TEST_SETTINGS } from "@/ai/test-fixtures";
import type { RankedOpportunity } from "./types";
import { OPPORTUNITY_SCORE_WEIGHTS } from "./types";

function baseRanked(
  overrides: Partial<RankedOpportunity> &
    Pick<RankedOpportunity, "symbol" | "quality">,
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
      riskScore: 75,
      dataQualityScore: 80,
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

function eligibleLevels(
  overrides: Partial<RankedOpportunity> &
    Pick<RankedOpportunity, "symbol" | "quality">,
): RankedOpportunity {
  return baseRanked({
    entry: 100,
    entryZoneLow: 99,
    entryZoneHigh: 101,
    stopLoss: 95,
    takeProfit1: 110,
    takeProfit2: 115,
    riskReward: 2,
    tradeStatus: "ELIGIBLE",
    ...overrides,
  });
}

describe("phase24 release", () => {
  it("release moved to phase 25 — see phase25.test.ts", () => {
    expect(RELEASE_PHASE).toBe(28);
  });
});

describe("phase24 bestStock / bestCrypto selection", () => {
  it("selects eligible confirmed setup with valid levels", () => {
    const nvda = eligibleLevels({ symbol: "NVDA", quality: "CONFIRMED" });
    expect(isActionableOpportunity(nvda)).toBe(true);
    expect(selectBestOpportunity([nvda])?.symbol).toBe("NVDA");
    const presented = toOpportunityCandidate(nvda);
    expect(presented.actionable).toBe(true);
    expect(presented.actionLabel).toMatch(/ENTER|WAIT FOR ENTRY/);
  });

  it("selects best crypto only from actionable crypto", () => {
    const btc = eligibleLevels({
      symbol: "BTC",
      quality: "STRONG",
      assetClass: "CRYPTO",
    });
    expect(selectBestOpportunity([btc])?.symbol).toBe("BTC");
  });

  it("never promotes blocked strong setup to best", () => {
    const meta = baseRanked({
      symbol: "META",
      quality: "STRONG",
      technicalConfirmation: "STRONG",
      tradeStatus: "BLOCKED",
      blockReason: "INVALID_RR",
      entry: 100,
      stopLoss: 95,
      takeProfit1: 102,
      takeProfit2: 103,
      riskReward: 0.4,
    });
    expect(isActionableOpportunity(meta)).toBe(false);
    expect(selectBestOpportunity([meta])).toBeNull();
    expect(deriveTradeAction(meta)).toBe("DO_NOT_ENTER");
    expect(tradeActionLabel("DO_NOT_ENTER")).toBe("DO NOT ENTER");
  });

  it("never promotes watch or early setup to best", () => {
    const watch = baseRanked({ symbol: "IWM", quality: "WATCH" });
    const early = baseRanked({
      symbol: "AMD",
      quality: "EARLY_SETUP",
      waitingFor: ["Bullish momentum confirmation"],
    });
    expect(selectBestOpportunity([watch, early])).toBeNull();
    expect(deriveTradeAction(early)).toBe("WAIT_FOR_CONFIRMATION");
  });

  it("returns no trade when only incomplete levels exist", () => {
    const incomplete = baseRanked({
      symbol: "AAPL",
      quality: "CONFIRMED",
      tradeStatus: "ELIGIBLE",
      entry: 100,
      stopLoss: 95,
      takeProfit1: 110,
      takeProfit2: null,
      riskReward: 2,
    });
    expect(isActionableOpportunity(incomplete)).toBe(false);
    expect(selectBestOpportunity([incomplete])).toBeNull();
  });

  it("rejects stale data from actionable best", () => {
    const stale = eligibleLevels({
      symbol: "TSLA",
      quality: "CONFIRMED",
      dataFreshness: "STALE",
      dataStatus: "STALE",
    });
    expect(hasAcceptableFreshness(stale)).toBe(false);
    expect(isActionableOpportunity(stale)).toBe(false);
    expect(selectBestOpportunity([stale])).toBeNull();
  });

  it("WAIT FOR ENTRY when price outside entry zone", () => {
    const setup = eligibleLevels({
      symbol: "NVDA",
      quality: "CONFIRMED",
      currentPrice: 108,
      entryZoneLow: 99,
      entryZoneHigh: 101,
    });
    expect(deriveTradeAction(setup)).toBe("WAIT_FOR_ENTRY");
    expect(tradeActionLabel("WAIT_FOR_ENTRY")).toBe("WAIT FOR ENTRY");
  });
});

describe("phase24 paper entry validation", () => {
  it("rejects WATCH confirmation with ENTRY REJECTED", () => {
    const snapshot = liveSnapshot({ dataStatus: "LIVE", currentPrice: 100 });
    const setup = emptyTradingSetup(snapshot, TEST_SETTINGS, {
      direction: "LONG",
      status: "VALID",
      entry: 100,
      stopLoss: 95,
      takeProfit: 110,
      riskReward: 2,
      positionSize: 1,
      positionValue: 100,
      riskAmount: 5,
      confirmation: {
        direction: "LONG",
        confirmation: "WATCH",
        trend: "BULLISH",
        momentum: "MISSING",
        ema: "BULLISH",
        macd: "POSITIVE",
        atrValid: true,
        rrValid: true,
        explain: "watch",
      },
    });
    const result = isPaperTradeableSetup(setup);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/ENTRY REJECTED/);
    }
  });

  it("accepts STRONG confirmation with valid levels", () => {
    const snapshot = liveSnapshot({ dataStatus: "LIVE", currentPrice: 100 });
    const setup = emptyTradingSetup(snapshot, TEST_SETTINGS, {
      direction: "LONG",
      status: "VALID",
      entry: 100,
      stopLoss: 95,
      takeProfit: 110,
      riskReward: 2,
      positionSize: 1,
      positionValue: 100,
      riskAmount: 5,
      confirmation: {
        direction: "LONG",
        confirmation: "STRONG",
        trend: "BULLISH",
        momentum: "POSITIVE",
        ema: "BULLISH",
        macd: "POSITIVE",
        atrValid: true,
        rrValid: true,
        explain: "strong",
      },
    });
    expect(isPaperTradeableSetup(setup)).toEqual({ ok: true });
  });
});

describe("phase24 exit states", () => {
  it("labels TP1 / TP2 / stop / thesis exits clearly", () => {
    expect(exitActionLabel("TAKE_PROFIT")).toBe("TAKE PROFIT");
    expect(exitActionLabel("PARTIAL_TAKE_PROFIT")).toBe("TAKE PARTIAL PROFIT");
    expect(exitActionLabel("STOP_LOSS")).toBe("STOP LOSS");
    expect(exitActionLabel("THESIS_INVALIDATED")).toBe("THESIS INVALIDATED");
    expect(exitActionLabel("HOLD")).toBe("HOLD");
  });

  it("evaluates stop loss and take profit from prices", () => {
    const stop = evaluateExitState({
      side: "LONG",
      entryPrice: 100,
      currentPrice: 94,
      stopLoss: 95,
      takeProfit: 110,
      takeProfit2: 115,
    });
    expect(stop.state).toBe("STOP_LOSS");

    const tp = evaluateExitState({
      side: "LONG",
      entryPrice: 100,
      currentPrice: 111,
      stopLoss: 95,
      takeProfit: 110,
      takeProfit2: 115,
    });
    expect(tp.state === "TAKE_PROFIT" || tp.state === "PARTIAL_TAKE_PROFIT").toBe(
      true,
    );

    const thesis = evaluateExitState({
      side: "LONG",
      entryPrice: 100,
      currentPrice: 101,
      stopLoss: 95,
      takeProfit: 110,
      thesisInvalidated: true,
    });
    expect(thesis.state).toBe("THESIS_INVALIDATED");
  });
});

describe("phase24 mtf / news unavailable honesty", () => {
  it("presents DATA_UNAVAILABLE mtf frames without inventing alignment", () => {
    const item = eligibleLevels({ symbol: "NVDA", quality: "CONFIRMED" });
    const presented = toOpportunityCandidate(item);
    expect(presented.mtf?.setup.available).toBe(false);
    expect(presented.mtf?.setup.reason).toBe("DATA_UNAVAILABLE");
    expect(presented.news).toEqual([]);
  });
});
