import { describe, expect, it } from "vitest";
import {
  computePositionPlan,
  deriveAiView,
  explainTradeAction,
  latestTimestamp,
} from "./ui-utils";
import {
  filterCandidates,
  sortCandidates,
  type TableFilter,
} from "./table-utils";
import type { RankedOpportunity } from "./types";
import { isActionableOpportunity } from "./actionable";

function baseRow(overrides: Partial<RankedOpportunity> = {}): RankedOpportunity {
  return {
    symbol: "AAPL",
    name: "Apple",
    assetClass: "STOCK",
    direction: "LONG",
    tier: "WATCH",
    quality: "WATCH",
    technicalConfirmation: "WATCH",
    tradeStatus: "NO_TRADE",
    blockReason: null,
    setupType: "NO_SETUP",
    holdingHorizon: "SWING",
    currentPrice: 100,
    atr14: 2,
    engineScore: 50,
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
      technicalScore: 50,
      momentumScore: 50,
      volumeScore: 50,
      newsScore: 35,
      catalystScore: 20,
      sentimentScore: 50,
      marketRegimeScore: 50,
      riskRewardScore: 50,
      multiTimeFrameScore: 50,
      multiTimeframeScore: 50,
      riskScore: 50,
      dataQualityScore: 50,
      opportunityScore: 50,
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
    confidence: 50,
    thesis: "test",
    mtf: {} as RankedOpportunity["mtf"],
    reasons: [],
    risks: [],
    waitingFor: [],
    newsHeadlines: [],
    newsItems: [],
    confirmation: null,
    scannedAt: new Date().toISOString(),
    boardQuality: "WATCH",
    riskLevel: "MEDIUM",
    recommendedRiskPercent: 0.0075,
    discoveryTags: [],
    screenScore: 10,
    sector: "Technology",
    ...overrides,
  };
}

describe("phase28 ui utils", () => {
  it("does not calculate position plan without entry and stop", () => {
    const plan = computePositionPlan({
      accountCapital: 10000,
      item: baseRow(),
      riskLevel: "MEDIUM",
      recommendedRiskPercent: 0.0075,
    });
    expect(plan.valid).toBe(false);
    expect(plan.positionSize).toBeNull();
  });

  it("calculates position plan from valid levels", () => {
    const plan = computePositionPlan({
      accountCapital: 10000,
      item: baseRow({
        entry: 100,
        stopLoss: 95,
        takeProfit1: 110,
        takeProfit2: 120,
        direction: "LONG",
      }),
      riskLevel: "LOW",
      recommendedRiskPercent: 0.01,
    });
    expect(plan.valid).toBe(true);
    expect(plan.positionSize).not.toBeNull();
  });

  it("prefers latest timestamp from candidates", () => {
    const latest = latestTimestamp([
      "2026-08-27T10:00:00.000Z",
      "2026-08-28T12:00:00.000Z",
      null,
    ]);
    expect(latest).toBe("2026-08-28T12:00:00.000Z");
  });

  it("explains wait for entry action", () => {
    const text = explainTradeAction("WAIT_FOR_ENTRY", baseRow());
    expect(text).toMatch(/outside the preferred entry zone/i);
  });
});

describe("phase28 table filters", () => {
  it("filters data skip separately from no trade", () => {
    const rows = [
      baseRow({ symbol: "A", boardQuality: "NO_TRADE", quality: "NO_TRADE" }),
      baseRow({
        symbol: "B",
        boardQuality: "DATA_SKIP",
        quality: "DATA_INSUFFICIENT",
      }),
    ];
    expect(filterCandidates(rows, ["DATA_SKIP"], "").map((r) => r.symbol)).toEqual([
      "B",
    ]);
    expect(filterCandidates(rows, ["NO_TRADE"], "").map((r) => r.symbol)).toEqual([
      "A",
    ]);
  });

  it("sorts actionable trades ahead of watch on default rank", () => {
    const watch = baseRow({
      symbol: "WATCH",
      quality: "WATCH",
      boardQuality: "WATCH",
      scores: { ...baseRow().scores, opportunityScore: 90 },
    });
    const trade = baseRow({
      symbol: "TRADE",
      quality: "CONFIRMED",
      boardQuality: "TRADE",
      tradeStatus: "ELIGIBLE",
      entry: 100,
      stopLoss: 95,
      takeProfit1: 110,
      takeProfit2: 120,
      riskReward: 2,
      currentPrice: 100,
      scores: { ...baseRow().scores, opportunityScore: 70 },
    });
    expect(isActionableOpportunity(trade)).toBe(true);
    const sorted = sortCandidates([watch, trade], "default");
    expect(sorted[0]?.symbol).toBe("TRADE");
  });

  it("filters by sector without provider calls", () => {
    const rows = [
      baseRow({ symbol: "NVDA", sector: "Technology" }),
      baseRow({ symbol: "JPM", sector: "Financials" }),
    ];
    expect(
      filterCandidates(rows, ["ALL"], "", "Technology").map((row) => row.symbol),
    ).toEqual(["NVDA"]);
  });

  it("supports breakout discovery filter", () => {
    const rows = [
      baseRow({ symbol: "A", discoveryTags: ["BREAKOUT"] }),
      baseRow({ symbol: "B", discoveryTags: ["UNUSUAL_VOLUME"] }),
    ];
    expect(
      filterCandidates(rows, ["BREAKOUT" as TableFilter], "").map((r) => r.symbol),
    ).toEqual(["A"]);
  });
});

describe("phase28 ai view", () => {
  it("uses deterministic action when ai research unavailable", () => {
    const view = deriveAiView(baseRow());
    expect(view.source).toBe("deterministic");
    expect(view.label).toBeTruthy();
  });
});
