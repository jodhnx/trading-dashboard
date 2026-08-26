import { describe, expect, it } from "vitest";
import {
  longSetup,
  shortSetup,
  liveSnapshot,
  TEST_SETTINGS,
} from "@/ai/test-fixtures";
import { emptyTradingSetup } from "@/engine/trading/setup";
import {
  classifyOpportunityTier,
  computeOpportunityScore,
  isDataQualityRejection,
  riskRewardScore,
} from "./score";
import { scoreSetup } from "@/engine/trading/score";
import { deriveEntryPlan } from "./entry";
import { toProviderSymbol } from "@/services/market/symbols";
import { OPPORTUNITY_UNIVERSE } from "./universe";

describe("phase 19 actionable opportunity semantics", () => {
  it("surfaces valid LONG stock setups with engine entry/SL/TP", () => {
    const setup = longSetup();
    expect(setup.direction).toBe("LONG");
    expect(setup.status).toBe("VALID");
    expect(setup.entry).not.toBeNull();
    expect(setup.stopLoss).not.toBeNull();
    expect(setup.takeProfit).not.toBeNull();
    const tier = classifyOpportunityTier({
      setup,
      opportunityScore: 52,
      dataStatus: "LIVE",
      hasTechnicals: true,
    });
    expect(tier.tier).toBe("OPPORTUNITY");
    const plan = deriveEntryPlan({ setup, atr14: 5 });
    expect(plan.entryZoneLow).not.toBeNull();
    expect(plan.invalidation).toBe(setup.stopLoss);
  });

  it("surfaces valid SHORT setups as OPPORTUNITY", () => {
    const setup = shortSetup();
    expect(setup.direction).toBe("SHORT");
    expect(setup.status).toBe("VALID");
    expect(
      classifyOpportunityTier({
        setup,
        opportunityScore: 55,
        dataStatus: "CACHED",
        hasTechnicals: true,
      }).tier,
    ).toBe("OPPORTUNITY");
  });

  it("keeps WATCH for LIVE NO_TRADE without inventing levels", () => {
    const setup = emptyTradingSetup(liveSnapshot(), TEST_SETTINGS, {
      direction: "NO_TRADE",
      status: "REJECTED",
      riskReward: null,
      entry: null,
      stopLoss: null,
      takeProfit: null,
    });
    expect(
      classifyOpportunityTier({
        setup,
        opportunityScore: 55,
        dataStatus: "LIVE",
        hasTechnicals: true,
      }).tier,
    ).toBe("WATCH");
    const plan = deriveEntryPlan({ setup, atr14: 5 });
    expect(plan.entryZoneLow).toBeNull();
  });

  it("marks UNAVAILABLE as data rejection, not a trading call", () => {
    const result = classifyOpportunityTier({
      setup: emptyTradingSetup(
        liveSnapshot({ dataStatus: "UNAVAILABLE" }),
        TEST_SETTINGS,
      ),
      opportunityScore: 90,
      dataStatus: "UNAVAILABLE",
      hasTechnicals: false,
    });
    expect(result.rejectionReason).toBe("data_unavailable");
    expect(isDataQualityRejection(result.rejectionReason)).toBe(true);
  });

  it("does not invent prices when RR is missing", () => {
    expect(riskRewardScore(null)).toBe(50);
    const setup = emptyTradingSetup(liveSnapshot(), TEST_SETTINGS, {
      direction: "NO_TRADE",
      status: "REJECTED",
      riskReward: null,
    });
    const scores = computeOpportunityScore({
      technicalBreakdown: scoreSetup(liveSnapshot(), "LONG"),
      setup,
      newsScore: 40,
      catalystScore: 30,
      sentimentScore: 50,
      marketRegime: "SIDEWAYS",
    });
    expect(scores.riskRewardScore).toBe(50);
  });

  it("maps required crypto symbols to Twelve Data pairs", () => {
    expect(toProviderSymbol("BTC")).toBe("BTC/USD");
    expect(toProviderSymbol("ETH")).toBe("ETH/USD");
    expect(toProviderSymbol("SOL")).toBe("SOL/USD");
    expect(toProviderSymbol("XRP")).toBe("XRP/USD");
    expect(toProviderSymbol("LINK")).toBe("LINK/USD");
    expect(toProviderSymbol("BNB")).toBe("BNB/USD");
    expect(toProviderSymbol("DOGE")).toBe("DOGE/USD");
  });

  it("includes the required liquid stock and crypto universe", () => {
    const symbols = new Set(OPPORTUNITY_UNIVERSE.map((a) => a.symbol));
    for (const symbol of [
      "SPY",
      "QQQ",
      "IWM",
      "DIA",
      "XLK",
      "XLF",
      "XLE",
      "AAPL",
      "MSFT",
      "NVDA",
      "AMZN",
      "META",
      "GOOGL",
      "TSLA",
      "AMD",
      "AVGO",
      "NFLX",
      "JPM",
      "V",
      "MA",
      "COST",
      "BTC",
      "ETH",
      "SOL",
      "XRP",
      "LINK",
      "BNB",
      "DOGE",
    ]) {
      expect(symbols.has(symbol)).toBe(true);
    }
  });
});
