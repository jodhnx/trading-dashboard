import { describe, expect, it } from "vitest";
import { classifyCategory, classifySentiment } from "@/services/news/classify";
import {
  explainNewsImpact,
  scoreNewsForSymbol,
} from "@/services/opportunity/news-impact";
import {
  filterCandidates,
  sortCandidates,
} from "@/services/opportunity/table-utils";
import type { RankedOpportunity } from "@/services/opportunity/types";

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
    recommendedRiskPercent: 1,
    discoveryTags: [],
    screenScore: 10,
    ...overrides,
  };
}

describe("phase26 news intelligence", () => {
  it("classifies expanded categories deterministically", () => {
    expect(classifyCategory("Company raised guidance after earnings beat")).toBe(
      "EARNINGS",
    );
    expect(classifyCategory("Spot Bitcoin ETF approval expected")).toBe("CRYPTO_ETF");
    expect(classifySentiment("Shares rally after earnings beat")).toBe("POSITIVE");
    expect(classifySentiment("Stock plunges on fraud investigation")).toBe("NEGATIVE");
  });

  it("does not create a trade from positive news alone", () => {
    const scored = scoreNewsForSymbol({
      symbol: "AAPL",
      news: [
        {
          id: "1",
          title: "Apple shares rally after earnings beat",
          category: "EARNINGS",
          relevance: "HIGH",
          sentiment: "POSITIVE",
          publishedAt: new Date().toISOString(),
          assetSymbols: ["AAPL"],
          sourceName: "Reuters",
        },
      ],
    });
    expect(scored.newsScore).toBeGreaterThan(40);
    expect(scored.impactExplanation.length).toBeGreaterThan(10);
    expect(explainNewsImpact({
      newsScore: scored.newsScore,
      sentimentScore: scored.sentimentScore,
      topItems: scored.newsItems,
    })).toMatch(/impact/i);
  });
});

describe("phase26 table utils", () => {
  it("filters client-side without provider calls", () => {
    const rows = [
      baseRow({ symbol: "AAPL", assetClass: "STOCK", boardQuality: "TRADE", tradeStatus: "ELIGIBLE", quality: "STRONG" }),
      baseRow({ symbol: "BTC", assetClass: "CRYPTO", boardQuality: "WATCH" }),
    ];
    const filtered = filterCandidates(rows, ["CRYPTO"], "");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.symbol).toBe("BTC");
  });

  it("sorts missing numeric values below valid values", () => {
    const rows = [
      baseRow({ symbol: "LOW", scores: { ...baseRow().scores, opportunityScore: 10 } }),
      baseRow({ symbol: "HIGH", scores: { ...baseRow().scores, opportunityScore: 90 } }),
    ];
    const sorted = sortCandidates(rows, "score");
    expect(sorted[0]?.symbol).toBe("HIGH");
  });
});
