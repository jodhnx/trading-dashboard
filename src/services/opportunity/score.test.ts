import { describe, expect, it } from "vitest";
import { longSetup, liveSnapshot } from "@/ai/test-fixtures";
import { scoreSetup } from "@/engine/trading/score";
import {
  classifyOpportunityTier,
  computeOpportunityScore,
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

  it("does not force opportunities on NO_TRADE / unavailable data", () => {
    const setup = longSetup();
    expect(
      classifyOpportunityTier({
        setup: { ...setup, direction: "NO_TRADE", status: "INVALID" },
        opportunityScore: 90,
        dataStatus: "LIVE",
      }),
    ).toBe("NO_TRADE");
    expect(
      classifyOpportunityTier({
        setup,
        opportunityScore: 90,
        dataStatus: "UNAVAILABLE",
      }),
    ).toBe("NO_TRADE");
  });

  it("scores risk/reward transparently", () => {
    expect(riskRewardScore(3)).toBe(100);
    expect(riskRewardScore(2)).toBe(80);
    expect(riskRewardScore(null)).toBe(0);
  });
});

describe("market regime", () => {
  it("detects bull / bear / high volatility", () => {
    expect(
      detectMarketRegime([
        { symbol: "SPY", trend: "BULLISH", volatility: "NORMAL", dataStatus: "LIVE" },
        { symbol: "QQQ", trend: "BULLISH", volatility: "NORMAL", dataStatus: "LIVE" },
        { symbol: "IWM", trend: "BULLISH", volatility: "NORMAL", dataStatus: "LIVE" },
      ]),
    ).toBe("BULL");
    expect(
      detectMarketRegime([
        { symbol: "SPY", trend: "BEARISH", volatility: "HIGH", dataStatus: "LIVE" },
        { symbol: "QQQ", trend: "BEARISH", volatility: "HIGH", dataStatus: "LIVE" },
      ]),
    ).toBe("HIGH_VOLATILITY");
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
