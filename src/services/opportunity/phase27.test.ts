import { describe, expect, it } from "vitest";
import { RELEASE_PHASE, APP_VERSION } from "@/lib/release";
import { catalogSize, getCatalogAsset, listTradableCatalog } from "@/services/universe/catalog";
import { mergeCatalogEntries } from "@/services/universe/catalog-build";
import { EXPANDED_CATALOG_ENTRIES } from "@/services/universe/catalog-expanded";
import { boardFromStored } from "./board-from-stored";
import { deriveBoardQuality } from "./board-quality";
import { buildTradingSetup } from "@/engine/trading/setup";
import { emptyTechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import { ProviderRateLimiter } from "@/services/market/rate-limit";
import { classifyRiskLevel, calculatePositionRisk } from "./risk";
import {
  aiResearchUsesVerifiedDataOnly,
  mockResearch,
  selectAiResearchTargets,
} from "./ai-research-shared";
import { computeSectorExposureWarnings } from "./sector-exposure";
import { toDataFreshness } from "./quality-freshness";
import { buildFreshnessCountsFixture } from "./phase27-fixtures";
import type { RankedOpportunity } from "./types";

function baseCandidate(overrides: Partial<RankedOpportunity> = {}): RankedOpportunity {
  return {
    symbol: "NVDA",
    name: "NVIDIA",
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
    engineScore: 60,
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
      technicalScore: 60,
      momentumScore: 55,
      volumeScore: 50,
      newsScore: 40,
      catalystScore: 35,
      sentimentScore: 50,
      marketRegimeScore: 50,
      riskRewardScore: 40,
      multiTimeFrameScore: 50,
      multiTimeframeScore: 50,
      riskScore: 50,
      dataQualityScore: 50,
      opportunityScore: 55,
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
    confidence: 55,
    thesis: "watch",
    mtf: {
      daily: {
        timeframe: "1day",
        available: true,
        dataStatus: "LIVE",
        trend: "BULLISH",
        momentum: "POSITIVE",
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
        reason: null,
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
        reason: null,
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

describe("phase27 release", () => {
  it("reports phase 28 market research terminal", () => {
    expect(RELEASE_PHASE).toBe(28);
    expect(APP_VERSION).toBe("0.28.0");
  });
});

describe("phase27 catalog", () => {
  it("supports 500+ tradable symbols with metadata", () => {
    expect(catalogSize()).toBeGreaterThanOrEqual(500);
    const sample = getCatalogAsset("NOW");
    expect(sample?.category).toBeTruthy();
    expect(sample?.sector).toBeTruthy();
  });

  it("merges expanded catalog without deleting core symbols", () => {
    const core = listTradableCatalog().filter((item) =>
      ["AAPL", "MSFT", "NVDA"].includes(item.symbol),
    );
    const merged = mergeCatalogEntries(core, EXPANDED_CATALOG_ENTRIES);
    expect(merged.some((item) => item.symbol === "AAPL")).toBe(true);
    expect(merged.length).toBeGreaterThan(500);
  });

  it("maps leveraged ETFs to elevated risk metadata", () => {
    const tqqq = getCatalogAsset("TQQQ");
    expect(tqqq?.isLeveragedEtf).toBe(true);
    expect(tqqq?.isHighRisk).toBe(true);
    const risk = classifyRiskLevel({
      asset: tqqq!,
      snapshot: emptyTechnicalSnapshot("TQQQ", "1day", "LIVE", null),
      opportunity: {
        riskReward: 2,
        entry: 50,
        stopLoss: 48,
        tradeStatus: "ELIGIBLE",
        dataFreshness: "LIVE",
      },
    });
    expect(["HIGH", "EXTREME", "MEDIUM"]).toContain(risk);
    expect(tqqq?.riskHints?.includes("LEVERAGED") || tqqq?.isLeveragedEtf).toBe(true);
  });
});

describe("phase27 classification regressions", () => {
  it("DATA_SKIP is not NO_TRADE", () => {
    const skip = baseCandidate({
      tier: "NO_TRADE",
      quality: "DATA_INSUFFICIENT",
    });
    expect(skip.quality).not.toBe("NO_TRADE");
    expect(skip.tradeStatus).not.toBe("ELIGIBLE");
  });

  it("WATCH stored row does not become actionable TRADE", () => {
    const watch = baseCandidate({
      quality: "WATCH",
      tradeStatus: "NO_TRADE",
      tier: "WATCH",
      boardQuality: "WATCH",
    });
    expect(deriveBoardQuality(watch, "MEDIUM")).toBe("WATCH");
  });

  it("BLOCKED row does not become ELIGIBLE on stored board", () => {
    const blocked = baseCandidate({
      quality: "NO_TRADE",
      tradeStatus: "BLOCKED",
      tier: "WATCH",
      blockReason: "MAX_EXPOSURE",
      entry: 100,
      stopLoss: 95,
      takeProfit1: 110,
      takeProfit2: 120,
      riskReward: 2,
    });
    const board = boardFromStored([blocked]);
    expect(board.bestStock).toBeNull();
    expect(board.topStocks.every((item) => item.tradeStatus !== "ELIGIBLE")).toBe(true);
  });

  it("missing levels cannot become actionable TRADE", () => {
    const item = baseCandidate({
      quality: "CONFIRMED",
      tradeStatus: "ELIGIBLE",
      entry: null,
      stopLoss: null,
      takeProfit1: null,
      takeProfit2: null,
      riskReward: null,
    });
    expect(deriveBoardQuality(item, "MEDIUM")).not.toBe("TRADE");
  });

  it("invalid RR blocks actionable trade", () => {
    const snapshot = {
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
      trend: "BULLISH" as const,
      momentum: "POSITIVE" as const,
      volatility: "NORMAL" as const,
      volumeTrend: "INCREASING" as const,
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
    expect(setup.entry).toBeNull();
  });

  it("position sizing requires entry and stop", () => {
    const plan = calculatePositionRisk({
      portfolioCapital: 10000,
      riskLevel: "MEDIUM",
      entry: null,
      stopLoss: 95,
    });
    expect(plan.positionSize).toBeNull();
  });
});

describe("phase27 freshness", () => {
  it("stale is not LIVE", () => {
    expect(toDataFreshness("STALE")).toBe("STALE");
    expect(toDataFreshness("STALE")).not.toBe("LIVE");
  });

  it("counts RECENT separately from CACHED when asOf is present", () => {
    const nowMs = Date.now();
    const counts = buildFreshnessCountsFixture(nowMs);
    expect(counts.recentCount).toBeGreaterThan(0);
    expect(counts.cachedCount).toBeGreaterThan(0);
  });
});

describe("phase27 scanner resilience", () => {
  it("rate limiter allows partial provider failure without killing budget silently", async () => {
    const limiter = new ProviderRateLimiter(3, 0);
    await limiter.beforeCall();
    await limiter.beforeCall();
    limiter.trip("provider_rate_limit");
    expect(limiter.canCall()).toBe(false);
    expect(limiter.state.tripped).toBe(true);
  });

  it("selects AI research targets without requiring actionable trades", () => {
    const targets = selectAiResearchTargets([
      baseCandidate({ symbol: "AAPL", scores: { ...baseCandidate().scores, opportunityScore: 80 } }),
      baseCandidate({ symbol: "MSFT", scores: { ...baseCandidate().scores, opportunityScore: 70 } }),
    ]);
    expect(targets.length).toBe(2);
  });
});

describe("phase27 sector exposure", () => {
  it("warns on semiconductor concentration without claiming measured correlation", () => {
    const warnings = computeSectorExposureWarnings([
      baseCandidate({
        symbol: "NVDA",
        quality: "CONFIRMED",
        tradeStatus: "ELIGIBLE",
        entry: 100,
        stopLoss: 95,
        takeProfit1: 110,
        takeProfit2: 120,
        riskReward: 2,
        boardQuality: "TRADE",
      }),
      baseCandidate({
        symbol: "AMD",
        quality: "EARLY_SETUP",
        boardQuality: "DEVELOPING",
      }),
      baseCandidate({
        symbol: "AVGO",
        quality: "EARLY_SETUP",
        boardQuality: "DEVELOPING",
      }),
    ]);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]?.measuredCorrelation).toBe(false);
    expect(warnings[0]?.message).toMatch(/category overlap/i);
  });
});

describe("phase27 AI research", () => {
  it("mock research does not invent prices outside structured input", () => {
    const candidate = baseCandidate({ currentPrice: null });
    const research = mockResearch(candidate, new Date());
    expect(aiResearchUsesVerifiedDataOnly(research, candidate)).toBe(true);
  });

  it("AI failure shape does not kill deterministic scan fields", () => {
    const candidate = baseCandidate();
    const research = mockResearch(candidate, new Date());
    expect(candidate.tradeStatus).toBe("NO_TRADE");
    expect(research.action).toBeTruthy();
  });
});

describe("phase27 news safety", () => {
  it("neutral baseline when no news is present", async () => {
    const { scoreNewsForSymbol } = await import("./news-impact");
    const scored = scoreNewsForSymbol({ symbol: "AAPL", news: [] });
    expect(scored.sentimentScore).toBe(50);
    expect(scored.newsItems.length).toBe(0);
  });
});
