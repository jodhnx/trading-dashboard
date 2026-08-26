import { describe, expect, it } from "vitest";
import { liveSnapshot, TEST_SETTINGS } from "@/ai/test-fixtures";
import { buildTradingSetup, emptyTradingSetup } from "@/engine/trading/setup";
import { evaluateSetupConfirmation } from "@/engine/trading/confirmation";
import { evaluateTradeEligibility } from "./trade-status";
import {
  calculateMultiTimeframeScore,
  evaluateMultiTimeframeAlignment,
} from "./mtf";
import {
  OPPORTUNITY_SCORE_WEIGHTS,
  opportunityScoreWeightsSum,
} from "./types";
import { computeOpportunityScore } from "./score";
import { scoreSetup } from "@/engine/trading/score";
import { longSetup } from "@/ai/test-fixtures";

describe("phase22 final — trade status separation", () => {
  it("TEST1: neutral trend → WATCH technical, NO_TRADE, TREND_NOT_DIRECTIONAL", () => {
    const snapshot = liveSnapshot({
      trend: "NEUTRAL",
      momentum: "POSITIVE",
      ema20: 100,
      ema50: 100,
      ema200: 100,
      macdHistogram: 0.4,
      atr14: 2,
      currentPrice: 100,
      dataStatus: "LIVE",
    });
    const setup = emptyTradingSetup(snapshot, TEST_SETTINGS, {
      direction: "NO_TRADE",
      status: "REJECTED",
    });
    const result = evaluateTradeEligibility({
      setup,
      snapshot,
      dataFreshness: "LIVE",
    });
    expect(result.technicalConfirmation).toBe("WATCH");
    expect(result.tradeStatus).toBe("NO_TRADE");
    expect(result.blockReason).toBe("TREND_NOT_DIRECTIONAL");
    expect(result.quality).toBe("WATCH");
    expect(result.signalDirection).toBe("NONE");
  });

  it("TEST2: STRONG short + INVALID_RR → BLOCKED, quality NO_TRADE, not WATCH", () => {
    const snapshot = liveSnapshot({
      symbol: "META",
      trend: "BEARISH",
      momentum: "NEGATIVE",
      ema20: 98,
      ema50: 101,
      ema200: 110,
      rsi14: 35,
      macd: -1,
      macdSignal: -0.3,
      macdHistogram: -0.4,
      atr14: 2.5,
      currentPrice: 100,
      dataStatus: "LIVE",
    });
    const conf = evaluateSetupConfirmation(snapshot);
    expect(conf.confirmation).toMatch(/STRONG|CONFIRMED/);
    const setup = emptyTradingSetup(snapshot, TEST_SETTINGS, {
      direction: "SHORT",
      status: "INVALID",
      score: 80,
      confirmation: { ...conf, rrValid: false },
      entry: 100,
      stopLoss: 101,
      takeProfit: 99,
      riskReward: 0.5,
      rejectReasons: ["INVALID_RR"],
      reasons: ["Risk/reward below minimum"],
    });

    const result = evaluateTradeEligibility({
      setup,
      snapshot,
      dataFreshness: "LIVE",
    });
    expect(result.technicalConfirmation).toBe("STRONG");
    expect(result.tradeStatus).toBe("BLOCKED");
    expect(result.blockReason).toBe("INVALID_RR");
    expect(result.signalDirection).toBe("SHORT");
    expect(result.quality).toBe("NO_TRADE");
  });

  it("TEST3: STRONG short + valid RR → ELIGIBLE SHORT", () => {
    const snapshot = liveSnapshot({
      trend: "BEARISH",
      momentum: "NEGATIVE",
      ema20: 98,
      ema50: 101,
      ema200: 110,
      rsi14: 35,
      macd: -1,
      macdSignal: -0.3,
      macdHistogram: -0.4,
      atr14: 2.5,
      currentPrice: 100,
      dataStatus: "LIVE",
    });
    const setup = buildTradingSetup({
      snapshot,
      settings: TEST_SETTINGS,
      now: new Date("2026-08-26T14:00:00.000Z"),
      atrMultiplier: 1,
    });
    expect(setup.status).toBe("VALID");
    expect(setup.direction).toBe("SHORT");
    const result = evaluateTradeEligibility({
      setup,
      snapshot,
      dataFreshness: "LIVE",
    });
    expect(result.technicalConfirmation).toBe("STRONG");
    expect(result.tradeStatus).toBe("ELIGIBLE");
    expect(result.blockReason).toBeNull();
    expect(result.signalDirection).toBe("SHORT");
    expect(["STRONG", "CONFIRMED"]).toContain(result.quality);
  });
});

describe("phase22 final — MTF", () => {
  it("TEST4: 1D+4H+1H bullish → high MTF score, aligned", () => {
    const daily = liveSnapshot({
      timeframe: "1day",
      trend: "BULLISH",
      momentum: "POSITIVE",
      dataStatus: "LIVE",
    });
    const setup = liveSnapshot({
      timeframe: "4h",
      trend: "BULLISH",
      momentum: "POSITIVE",
      dataStatus: "LIVE",
    });
    const entry = liveSnapshot({
      timeframe: "1h",
      trend: "BULLISH",
      momentum: "POSITIVE",
      dataStatus: "LIVE",
    });
    const { score, alignment } = calculateMultiTimeframeScore({
      daily,
      setup,
      entry,
    });
    expect(alignment.aligned).toBe(true);
    expect(score).toBeGreaterThanOrEqual(90);
    expect(alignment.daily.available).toBe(true);
    expect(alignment.setup.available).toBe(true);
    expect(alignment.entry.available).toBe(true);
    expect(alignment.setup.ema20).not.toBeNull();
    expect(alignment.entry.atr14).not.toBeNull();
  });

  it("TEST5: missing 4H/1H → no fabricated values, neutral score", () => {
    const daily = liveSnapshot({
      timeframe: "1day",
      trend: "BULLISH",
      dataStatus: "LIVE",
    });
    const alignment = evaluateMultiTimeframeAlignment({
      daily,
      setup: null,
      entry: null,
    });
    expect(alignment.setup.available).toBe(false);
    expect(alignment.entry.available).toBe(false);
    expect(alignment.setup.reason).toBe("DATA_UNAVAILABLE");
    expect(alignment.entry.reason).toBe("DATA_UNAVAILABLE");
    expect(alignment.setup.trend).toBe("UNKNOWN");
    expect(alignment.aligned).toBe(false);
    expect(alignment.score).toBe(50);
  });

  it("TEST6: opportunity score weights sum exactly 100", () => {
    expect(opportunityScoreWeightsSum()).toBe(100);
    expect(OPPORTUNITY_SCORE_WEIGHTS.multiTimeFrame).toBe(10);
    expect(OPPORTUNITY_SCORE_WEIGHTS.technical).toBe(20);
    const scores = computeOpportunityScore({
      technicalBreakdown: scoreSetup(liveSnapshot(), "LONG"),
      setup: longSetup(),
      newsScore: 50,
      catalystScore: 50,
      sentimentScore: 50,
      marketRegime: "BULL",
      multiTimeFrameScore: 80,
    });
    expect(scores.multiTimeFrameScore).toBe(80);
    expect(scores.weights.multiTimeFrame).toBe(10);
    expect(Object.values(scores.weights).reduce((a, b) => a + b, 0)).toBe(100);
  });
});
