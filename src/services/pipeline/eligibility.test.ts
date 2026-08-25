import { describe, expect, it } from "vitest";
import { isPipelineAnalysisEligible } from "./eligibility";

describe("isPipelineAnalysisEligible", () => {
  it("skips unavailable market data", () => {
    expect(
      isPipelineAnalysisEligible({
        dataStatus: "UNAVAILABLE",
        setupDirection: "LONG",
      }).eligible,
    ).toBe(false);
  });

  it("skips mock and stale data", () => {
    expect(
      isPipelineAnalysisEligible({
        dataStatus: "MOCK",
        setupDirection: "LONG",
      }).eligible,
    ).toBe(false);
    expect(
      isPipelineAnalysisEligible({
        dataStatus: "STALE",
        setupDirection: "LONG",
      }).eligible,
    ).toBe(false);
  });

  it("skips NO_TRADE setups", () => {
    expect(
      isPipelineAnalysisEligible({
        dataStatus: "LIVE",
        setupDirection: "NO_TRADE",
      }).eligible,
    ).toBe(false);
  });

  it("allows LONG and SHORT setups with live data", () => {
    expect(
      isPipelineAnalysisEligible({
        dataStatus: "LIVE",
        setupDirection: "LONG",
      }).eligible,
    ).toBe(true);
    expect(
      isPipelineAnalysisEligible({
        dataStatus: "CACHED",
        setupDirection: "SHORT",
      }).eligible,
    ).toBe(true);
  });
});
