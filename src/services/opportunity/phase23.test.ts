import { describe, expect, it } from "vitest";
import { RELEASE_PHASE, APP_VERSION } from "@/lib/release";
import { opportunityScoreWeightsSum, OPPORTUNITY_SCORE_WEIGHTS } from "./types";
import { emptyMtfAlignment } from "./mtf";
import { liveSnapshot } from "@/ai/test-fixtures";
import { evaluateTradeEligibility } from "./trade-status";
import { emptyTradingSetup } from "@/engine/trading/setup";
import { TEST_SETTINGS } from "@/ai/test-fixtures";
import { evaluateSetupConfirmation } from "@/engine/trading/confirmation";

describe("phase23 release readiness", () => {
  it("centralizes release phase at 23", () => {
    expect(RELEASE_PHASE).toBe(23);
    expect(APP_VERSION).toMatch(/^0\.23/);
  });

  it("keeps opportunity weights at exactly 100", () => {
    expect(opportunityScoreWeightsSum()).toBe(100);
    expect(OPPORTUNITY_SCORE_WEIGHTS.multiTimeFrame).toBe(10);
  });

  it("marks unenriched MTF frames as not_enriched (not fake DATA_UNAVAILABLE)", () => {
    const daily = liveSnapshot({ timeframe: "1day", dataStatus: "LIVE" });
    const mtf = emptyMtfAlignment(daily);
    expect(mtf.setup.reason).toBe("not_enriched");
    expect(mtf.entry.reason).toBe("not_enriched");
    expect(mtf.setup.available).toBe(false);
  });

  it("keeps BLOCKED strong setups as NO_TRADE quality (never buy)", () => {
    const snapshot = liveSnapshot({
      trend: "BEARISH",
      momentum: "NEGATIVE",
      ema20: 98,
      ema50: 101,
      ema200: 110,
      macdHistogram: -0.4,
      atr14: 2.5,
      currentPrice: 100,
      dataStatus: "LIVE",
    });
    const conf = evaluateSetupConfirmation(snapshot);
    const setup = emptyTradingSetup(snapshot, TEST_SETTINGS, {
      direction: "SHORT",
      status: "INVALID",
      confirmation: { ...conf, rrValid: false },
      rejectReasons: ["INVALID_RR"],
    });
    const result = evaluateTradeEligibility({
      setup,
      snapshot,
      dataFreshness: "LIVE",
    });
    expect(result.technicalConfirmation).toBe("STRONG");
    expect(result.tradeStatus).toBe("BLOCKED");
    expect(result.quality).toBe("NO_TRADE");
  });
});
