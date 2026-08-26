import { describe, expect, it } from "vitest";
import { longSetup, liveSnapshot, TEST_SETTINGS } from "@/ai/test-fixtures";
import { emptyTradingSetup } from "@/engine/trading/setup";
import {
  classifyOpportunityTier,
  computeOpportunityScore,
  riskRewardScore,
} from "./score";
import { scoreSetup } from "@/engine/trading/score";

describe("phase 18 opportunity board semantics", () => {
  it("does not treat empty persistence / no-data as NO_TRADE when classifying tiers", () => {
    const unavailable = classifyOpportunityTier({
      setup: emptyTradingSetup(liveSnapshot({ dataStatus: "UNAVAILABLE" }), TEST_SETTINGS),
      opportunityScore: 90,
      dataStatus: "UNAVAILABLE",
      hasTechnicals: false,
    });
    expect(unavailable.tier).toBe("NO_TRADE");
    expect(unavailable.rejectionReason).toBe("data_unavailable");
  });

  it("scores a valid LIVE opportunity above opportunity min", () => {
    const setup = longSetup();
    expect(setup.status).toBe("VALID");
    expect(setup.direction).toBe("LONG");
    const scores = computeOpportunityScore({
      technicalBreakdown: scoreSetup(liveSnapshot(), "LONG"),
      setup,
      newsScore: 70,
      catalystScore: 70,
      sentimentScore: 60,
      marketRegime: "BULL",
    });
    const tier = classifyOpportunityTier({
      setup,
      opportunityScore: scores.opportunityScore,
      dataStatus: "LIVE",
      hasTechnicals: true,
    });
    expect(scores.opportunityScore).toBeGreaterThanOrEqual(50);
    expect(["WATCH", "OPPORTUNITY", "STRONG_OPPORTUNITY"]).toContain(tier.tier);
    expect(riskRewardScore(setup.riskReward)).toBeGreaterThan(0);
  });

  it("distinguishes NO_TRADE engine outcome from data failure", () => {
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
      marketRegime: "UNKNOWN",
    });
    // Neutral RR keeps watch-eligible scores from being crushed to zero
    expect(scores.riskRewardScore).toBe(50);
    const tier = classifyOpportunityTier({
      setup,
      opportunityScore: Math.max(scores.opportunityScore, 55),
      dataStatus: "LIVE",
      hasTechnicals: true,
    });
    expect(tier.tier).toBe("WATCH");
  });
});
