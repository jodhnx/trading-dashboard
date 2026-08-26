import { describe, expect, it } from "vitest";
import { liveSnapshot, longSetup, shortSetup, TEST_SETTINGS } from "@/ai/test-fixtures";
import { emptyTradingSetup } from "@/engine/trading/setup";
import {
  buildSignalAssetDiagnostic,
  buildSignalDiagnosticsReport,
  findFirstDirectionBlocker,
} from "./signal-diagnostics";
import { classifyOpportunityTier } from "./score";
import { deriveEntryPlan } from "./entry";
import { toProviderSymbol } from "@/services/market/symbols";
import { evaluateSetupConfirmation } from "@/engine/trading/confirmation";

describe("signal diagnostics (Phase 21)", () => {
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
      confirmation: evaluateSetupConfirmation(snapshot),
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

  it("identifies EMA/MACD gap when trend+momentum present but neither confirms", () => {
    const snapshot = liveSnapshot({
      trend: "BULLISH",
      momentum: "POSITIVE",
      currentPrice: 100,
      ema20: 101,
      ema50: 97,
      ema200: 90,
      macdHistogram: -0.2,
    });
    expect(findFirstDirectionBlocker(snapshot)).toBe(
      "EMA_MACD_CONFIRMATION_MISSING",
    );
  });

  it("aggregates blockers and skip reasons", () => {
    const snapshot = liveSnapshot({
      trend: "NEUTRAL",
      momentum: "NEUTRAL",
      macdHistogram: 0,
    });
    const setup = emptyTradingSetup(snapshot, TEST_SETTINGS, {
      direction: "NO_TRADE",
      status: "REJECTED",
      confirmation: evaluateSetupConfirmation(snapshot),
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
      candidateDiagnostics: [
        { tier: "DATA_SKIP", rejectionReason: "provider_rate_limit" },
        { tier: "DATA_SKIP", rejectionReason: "data_unavailable" },
      ],
      dataSkipped: 2,
    });
    expect(report.validSetups).toBe(0);
    expect(report.skipReasons.provider_rate_limit).toBe(1);
    expect(report.confirmationSimulation.activeConfirmationRule).toMatch(
      /EMA OR MACD/i,
    );
    expect(report.whyNoSetup[0]).toMatch(/No VALID/i);
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

  it("maps stock and crypto provider symbols", () => {
    expect(toProviderSymbol("SPY")).toBe("SPY");
    expect(toProviderSymbol("BTC")).toBe("BTC/USD");
    expect(toProviderSymbol("BNB")).toBe("BNB/USD");
    expect(toProviderSymbol("USD")).toBeNull();
  });
});
