import { describe, expect, it } from "vitest";
import { longSetup, liveSnapshot } from "@/ai/test-fixtures";
import { scoreSetup } from "@/engine/trading/score";
import { emptyTradingSetup } from "@/engine/trading/setup";
import { TEST_SETTINGS } from "@/ai/test-fixtures";
import {
  classifyOpportunityTier,
  computeOpportunityScore,
  describeWaitingFor,
  riskRewardScore,
} from "./score";
import { detectMarketRegime } from "./regime";
import { scoreNewsForSymbol, correlateNewsWithMove } from "./news-impact";
import { deriveEntryPlan } from "./entry";

describe("opportunity scoring", () => {
  it("produces an explainable weighted score from components", () => {
    const setup = longSetup();
    const breakdown = scoreSetup(liveSnapshot(), setup.direction);
    const scores = computeOpportunityScore({
      technicalBreakdown: breakdown,
      setup,
      newsScore: 70,
      catalystScore: 80,
      sentimentScore: 60,
      marketRegime: "BULL",
    });
    expect(scores.opportunityScore).toBeGreaterThan(0);
    expect(scores.opportunityScore).toBeLessThanOrEqual(100);
    expect(scores.weights.technical).toBe(30);
    expect(scores.technicalScore).toBe(breakdown.total);
  });

  it("does not create STRONG/OPPORTUNITY for UNAVAILABLE data", () => {
    const setup = longSetup();
    expect(
      classifyOpportunityTier({
        setup,
        opportunityScore: 90,
        dataStatus: "UNAVAILABLE",
        hasTechnicals: true,
      }).tier,
    ).toBe("NO_TRADE");
  });

  it("allows WATCH for LIVE NO_TRADE when score clears watch min", () => {
    const snapshot = liveSnapshot();
    const setup = emptyTradingSetup(snapshot, TEST_SETTINGS, {
      direction: "NO_TRADE",
      status: "REJECTED",
      score: 55,
    });
    const result = classifyOpportunityTier({
      setup,
      opportunityScore: 58,
      dataStatus: "LIVE",
      hasTechnicals: true,
    });
    expect(result.tier).toBe("WATCH");
  });

  it("preserves VALID engine setups as OPPORTUNITY even below composite 65", () => {
    const setup = longSetup();
    expect(setup.status).toBe("VALID");
    expect(
      classifyOpportunityTier({
        setup,
        opportunityScore: 52,
        dataStatus: "LIVE",
        hasTechnicals: true,
      }).tier,
    ).toBe("OPPORTUNITY");
    expect(
      classifyOpportunityTier({
        setup,
        opportunityScore: 85,
        dataStatus: "CACHED",
        hasTechnicals: true,
      }).tier,
    ).toBe("STRONG_OPPORTUNITY");
  });

  it("requires VALID LONG/SHORT + LIVE/CACHED for OPPORTUNITY tier", () => {
    const setup = longSetup();
    expect(setup.status).toBe("VALID");
    expect(
      classifyOpportunityTier({
        setup,
        opportunityScore: 70,
        dataStatus: "LIVE",
        hasTechnicals: true,
      }).tier,
    ).toBe("OPPORTUNITY");
    expect(
      classifyOpportunityTier({
        setup,
        opportunityScore: 70,
        dataStatus: "STALE",
        hasTechnicals: true,
      }).tier,
    ).toBe("WATCH");
  });

  it("treats missing risk/reward as neutral, not zero", () => {
    expect(riskRewardScore(null)).toBe(50);
    expect(riskRewardScore(2)).toBe(80);
  });
});

describe("waiting for confirmation", () => {
  it("lists confirmation gaps for engine NO_TRADE", () => {
    const snapshot = liveSnapshot({
      trend: "NEUTRAL",
      momentum: "NEUTRAL",
      macdHistogram: 0,
    });
    const setup = emptyTradingSetup(snapshot, TEST_SETTINGS, {
      direction: "NO_TRADE",
      status: "REJECTED",
      reasons: ["Trend is neutral", "Signals disagree"],
      rejectReasons: ["NO_TRADE", "NO_TECHNICAL_EDGE"],
    });
    const waiting = describeWaitingFor({ setup, snapshot });
    expect(waiting.length).toBeGreaterThan(0);
    expect(waiting.some((item) => /trend/i.test(item))).toBe(true);
  });
});

describe("market regime", () => {
  it("detects bull from a single usable benchmark", () => {
    expect(
      detectMarketRegime([
        { symbol: "SPY", trend: "BULLISH", volatility: "NORMAL", dataStatus: "LIVE" },
        { symbol: "AAPL", trend: "UNKNOWN", volatility: "NORMAL", dataStatus: "UNAVAILABLE" },
      ]),
    ).toBe("BULL");
  });

  it("uses STALE benchmarks with known trends", () => {
    expect(
      detectMarketRegime([
        { symbol: "SPY", trend: "BEARISH", volatility: "NORMAL", dataStatus: "STALE" },
        { symbol: "QQQ", trend: "BEARISH", volatility: "NORMAL", dataStatus: "STALE" },
      ]),
    ).toBe("BEAR");
  });

  it("returns UNKNOWN when no usable trends exist", () => {
    expect(
      detectMarketRegime([
        { symbol: "SPY", trend: "UNKNOWN", volatility: "NORMAL", dataStatus: "LIVE" },
        { symbol: "QQQ", trend: "BULLISH", volatility: "NORMAL", dataStatus: "UNAVAILABLE" },
      ]),
    ).toBe("UNKNOWN");
  });
});

describe("news impact", () => {
  it("ranks news by relevance and recency without inventing articles", () => {
    const result = scoreNewsForSymbol({
      symbol: "NVDA",
      now: new Date("2026-08-26T12:00:00.000Z"),
      news: [
        {
          id: "1",
          title: "NVIDIA earnings beat estimates",
          category: "EARNINGS",
          relevance: "HIGH",
          sentiment: "POSITIVE",
          publishedAt: "2026-08-26T10:00:00.000Z",
          assetSymbols: ["NVDA"],
        },
      ],
    });
    expect(result.headlines[0]).toMatch(/NVIDIA/);
    expect(result.newsItems[0]?.title).toMatch(/NVIDIA/);
    expect(result.newsScore).toBeGreaterThan(50);
    expect(correlateNewsWithMove({ headline: "ETF news", changePercent: 4.8 })).toBe(
      "ETF news (+4.8%)",
    );
  });
});

describe("entry plan", () => {
  it("derives zones from engine levels only", () => {
    const setup = longSetup();
    const plan = deriveEntryPlan({ setup, atr14: 5 });
    expect(plan.entryZoneLow).not.toBeNull();
    expect(plan.invalidation).toBe(setup.stopLoss);
    expect(plan.takeProfit2).not.toBeNull();
  });
});
