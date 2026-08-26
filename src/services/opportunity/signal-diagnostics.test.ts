import { describe, expect, it } from "vitest";
import { liveSnapshot, longSetup, shortSetup, TEST_SETTINGS } from "@/ai/test-fixtures";
import { emptyTradingSetup } from "@/engine/trading/setup";
import { toProviderSymbol } from "@/services/market/symbols";
import {
  buildSignalAssetDiagnostic,
  buildSignalDiagnosticsReport,
  findFirstDirectionBlocker,
  simulateAltConfirmation,
} from "./signal-diagnostics";
import { classifyOpportunityTier } from "./score";
import { deriveEntryPlan } from "./entry";

describe("signal diagnostics", () => {
  it("does not treat LIVE quote alone as a VALID setup", () => {
    const snapshot = liveSnapshot({
      dataStatus: "LIVE",
      trend: "NEUTRAL",
      momentum: "NEUTRAL",
      macdHistogram: 0,
    });
    const setup = emptyTradingSetup(snapshot, TEST_SETTINGS, {
      direction: "NO_TRADE",
      status: "REJECTED",
    });
    const diag = buildSignalAssetDiagnostic({
      symbol: "QQQ",
      assetType: "ETF",
      quoteStatus: "LIVE",
      snapshot,
      setup,
      opportunityScore: 52,
      tier: "WATCH",
      rejectionReason: null,
    });
    expect(diag.quoteStatus).toBe("LIVE");
    expect(diag.engineDirection).toBe("NO_TRADE");
    expect(diag.firstBlocker).toBe("TREND_NOT_DIRECTIONAL");
  });

  it("identifies MACD as first blocker when trend/momentum/EMA already agree", () => {
    const snapshot = liveSnapshot({
      trend: "BULLISH",
      momentum: "POSITIVE",
      currentPrice: 100,
      ema20: 99,
      ema50: 97,
      ema200: 90,
      macdHistogram: -0.2,
    });
    expect(findFirstDirectionBlocker(snapshot)).toBe("MACD_NOT_CONFIRMED");
  });

  it("identifies EMA as first blocker before MACD when EMA fails", () => {
    const snapshot = liveSnapshot({
      trend: "BULLISH",
      momentum: "POSITIVE",
      currentPrice: 100,
      ema20: 101,
      ema50: 97,
      ema200: 90,
      macdHistogram: 0.4,
    });
    expect(findFirstDirectionBlocker(snapshot)).toBe("EMA_NOT_ALIGNED");
  });

  it("simulates alternative confirmation without changing the engine", () => {
    // Trend + momentum + MACD, but EMA not aligned → current NO_TRADE, alt LONG
    const snapshot = liveSnapshot({
      trend: "BULLISH",
      momentum: "POSITIVE",
      currentPrice: 100,
      ema20: 101,
      ema50: 97,
      ema200: 90,
      macdHistogram: 0.5,
    });
    expect(findFirstDirectionBlocker(snapshot)).toBe("EMA_NOT_ALIGNED");
    const alt = simulateAltConfirmation(snapshot);
    expect(alt.wouldPass).toBe(true);
    expect(alt.direction).toBe("LONG");
  });

  it("preserves rejection reason and aggregates blockers", () => {
    const snapshot = liveSnapshot({
      trend: "NEUTRAL",
      momentum: "NEUTRAL",
      macdHistogram: 0,
    });
    const setup = emptyTradingSetup(snapshot, TEST_SETTINGS, {
      direction: "NO_TRADE",
      status: "REJECTED",
    });
    const diag = buildSignalAssetDiagnostic({
      symbol: "IWM",
      assetType: "ETF",
      quoteStatus: "LIVE",
      snapshot,
      setup,
      opportunityScore: 51,
      tier: "WATCH",
      rejectionReason: null,
    });
    const report = buildSignalDiagnosticsReport({
      boardState: "WATCH_ONLY",
      diagnostics: [diag],
      dataSkipped: 18,
    });
    expect(report.validSetups).toBe(0);
    expect(report.dataSkipped).toBe(18);
    expect(report.blockerAggregate.trendBlocked).toBeGreaterThanOrEqual(1);
    expect(report.whyNoSetup[0]).toMatch(/No VALID/i);
    expect(report.confirmationSimulation.currentValid).toBe(0);
  });

  it("keeps valid LONG/SHORT as OPPORTUNITY with entry levels", () => {
    const long = longSetup();
    expect(
      classifyOpportunityTier({
        setup: long,
        opportunityScore: 52,
        dataStatus: "LIVE",
        hasTechnicals: true,
      }).tier,
    ).toBe("OPPORTUNITY");
    expect(deriveEntryPlan({ setup: long, atr14: 5 }).entryZoneLow).not.toBeNull();

    const short = shortSetup();
    expect(
      classifyOpportunityTier({
        setup: short,
        opportunityScore: 55,
        dataStatus: "LIVE",
        hasTechnicals: true,
      }).tier,
    ).toBe("OPPORTUNITY");
  });

  it("maps stock and crypto provider symbols without inventing data", () => {
    expect(toProviderSymbol("SPY")).toBe("SPY");
    expect(toProviderSymbol("GOOGL")).toBe("GOOGL");
    expect(toProviderSymbol("BTC")).toBe("BTC/USD");
    expect(toProviderSymbol("BNB")).toBe("BNB/USD");
    expect(toProviderSymbol("DOGE")).toBe("DOGE/USD");
    expect(toProviderSymbol("USD")).toBeNull();
  });
});
