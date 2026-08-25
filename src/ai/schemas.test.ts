import { describe, expect, it } from "vitest";
import { tradingAnalysisOutputSchema } from "./schemas";
import { analysisOutput, longSetup } from "./test-fixtures";

describe("tradingAnalysisOutputSchema", () => {
  const setup = longSetup();

  it("accepts a valid BUY_SETUP payload", () => {
    const parsed = tradingAnalysisOutputSchema.safeParse(analysisOutput(setup));
    expect(parsed.success).toBe(true);
  });

  it("rejects confidence below 0", () => {
    expect(
      tradingAnalysisOutputSchema.safeParse(analysisOutput(setup, { confidence: -1 }))
        .success,
    ).toBe(false);
  });

  it("rejects confidence above 100", () => {
    expect(
      tradingAnalysisOutputSchema.safeParse(analysisOutput(setup, { confidence: 101 }))
        .success,
    ).toBe(false);
  });

  it("rejects an invalid decision enum", () => {
    expect(
      tradingAnalysisOutputSchema.safeParse(
        analysisOutput(setup, { decision: "HOLD" as never }),
      ).success,
    ).toBe(false);
  });

  it("rejects a missing summary", () => {
    expect(
      tradingAnalysisOutputSchema.safeParse(analysisOutput(setup, { summary: "   " }))
        .success,
    ).toBe(false);
  });

  it("rejects an incomplete setupReference", () => {
    expect(
      tradingAnalysisOutputSchema.safeParse(
        analysisOutput(setup, {
          setupReference: {
            entry: 100,
            stopLoss: 95,
            takeProfit: 110,
            riskReward: 2,
          } as never,
        }),
      ).success,
    ).toBe(false);
  });
});
