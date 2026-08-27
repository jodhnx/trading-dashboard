import { describe, expect, it } from "vitest";
import { RELEASE_PHASE, APP_VERSION } from "@/lib/release";
import { catalogSize, listTradableCatalog } from "@/services/universe/catalog";
import { loadScanUniverse } from "./universe";
import { ProviderRateLimiter } from "@/services/market/rate-limit";
import {
  classifyRiskLevel,
  calculatePositionRisk,
  recommendedRiskPercent,
} from "./risk";
import { deriveBoardQuality } from "./board-quality";
import { selectDeepAnalysisTargets } from "@/services/universe/broad-screen";
import type { BroadScreenResult } from "@/services/universe/types";
import { liveSnapshot } from "@/ai/test-fixtures";

describe("phase25 release", () => {
  it("reports phase 25", () => {
    expect(RELEASE_PHASE).toBe(25);
    expect(APP_VERSION).toMatch(/^0\.25/);
  });
});

describe("phase25 broad universe", () => {
  it("expands beyond the legacy ~30 symbol cap", () => {
    expect(catalogSize()).toBeGreaterThan(30);
    expect(listTradableCatalog().length).toBeGreaterThan(100);
  });

  it("supports paginated universe loading", () => {
    const page = loadScanUniverse({ offset: 0, limit: 50 });
    expect(page.length).toBeLessThanOrEqual(50);
    const page2 = loadScanUniverse({ offset: 50, limit: 50 });
    expect(page2[0]?.symbol).not.toBe(page[0]?.symbol);
  });

  it("filters crypto catalog separately", () => {
    const crypto = loadScanUniverse({ assetClass: "CRYPTO" });
    expect(crypto.every((a) => a.assetClass === "CRYPTO")).toBe(true);
    expect(crypto.length).toBeGreaterThanOrEqual(7);
  });
});

describe("phase25 rate limiter", () => {
  it("trips on max calls budget", async () => {
    const limiter = new ProviderRateLimiter(2, 0);
    await limiter.beforeCall();
    await limiter.beforeCall();
    await expect(limiter.beforeCall()).rejects.toThrow(/BUDGET|RATE/i);
    expect(limiter.state.tripped).toBe(true);
  });
});

describe("phase25 risk engine", () => {
  it("never invents position size without entry/stop", () => {
    const plan = calculatePositionRisk({
      portfolioCapital: 10_000,
      riskLevel: "MEDIUM",
      entry: null,
      stopLoss: 95,
    });
    expect(plan.positionSize).toBeNull();
    expect(plan.recommendedRiskPercent).toBe(recommendedRiskPercent("MEDIUM"));
  });

  it("calculates deterministic position size from entry/stop", () => {
    const plan = calculatePositionRisk({
      portfolioCapital: 10_000,
      riskLevel: "LOW",
      entry: 100,
      stopLoss: 95,
    });
    expect(plan.positionSize).toBeCloseTo(20, 5);
    expect(plan.riskAmount).toBeCloseTo(100, 5);
  });

  it("returns UNKNOWN risk when data is stale", () => {
    const snapshot = liveSnapshot({ dataStatus: "STALE", currentPrice: 100 });
    const asset = listTradableCatalog()[0]!;
    const level = classifyRiskLevel({
      asset,
      snapshot,
      opportunity: {
        riskReward: 2,
        entry: 100,
        stopLoss: 95,
        tradeStatus: "ELIGIBLE",
        dataFreshness: "STALE",
      },
    });
    expect(level).toBe("UNKNOWN");
  });
});

describe("phase25 board quality", () => {
  it("maps ELIGIBLE confirmed to TRADE only with levels", () => {
    const item = {
      quality: "CONFIRMED" as const,
      tradeStatus: "ELIGIBLE" as const,
      technicalConfirmation: "STRONG",
      entry: 100,
      stopLoss: 95,
      takeProfit1: 110,
      takeProfit2: 120,
      riskReward: 2,
      currentPrice: 100,
    };
    expect(deriveBoardQuality(item, "MEDIUM")).toBe("TRADE");
  });

  it("never maps blocked setup to TRADE", () => {
    const item = {
      quality: "NO_TRADE" as const,
      tradeStatus: "BLOCKED" as const,
      technicalConfirmation: "STRONG",
      entry: 100,
      stopLoss: 95,
      takeProfit1: 102,
      takeProfit2: 110,
      riskReward: 2,
      currentPrice: 100,
    };
    expect(deriveBoardQuality(item, "HIGH")).toBe("SPECULATIVE");
  });
});

describe("phase25 deep analysis selection", () => {
  it("selects top candidates from broad screen", () => {
    const screened: BroadScreenResult[] = Array.from({ length: 200 }, (_, i) => ({
      symbol: `SYM${i}`,
      asset: listTradableCatalog()[0]!,
      quoteStatus: "LIVE",
      price: 100,
      changePercent: i % 5,
      volume: 1_000_000,
      screenScore: 200 - i,
      skipReason: null,
      signals: [],
    }));
    const targets = selectDeepAnalysisTargets(screened, 100);
    expect(targets.length).toBe(100);
    expect(targets[0]?.screenScore).toBeGreaterThan(targets[99]?.screenScore ?? 0);
  });
});
