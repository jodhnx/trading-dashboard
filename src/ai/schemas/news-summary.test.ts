import { describe, expect, it } from "vitest";
import { newsSummarySchema, AI_SUMMARY_UNAVAILABLE } from "./news-summary";

describe("AI news summary schema", () => {
  it("accepts only allowed enums", () => {
    const parsed = newsSummarySchema.safeParse({
      summary: "NVIDIA reported quarterly results.",
      category: "EARNINGS",
      sentiment: "UNKNOWN",
      relevance: "HIGH",
      affectedAssets: ["NVDA"],
      keyPoints: ["Results published"],
      uncertainties: ["Guidance not specified"],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects trading fields and invalid enums", () => {
    expect(
      newsSummarySchema.safeParse({
        summary: "Buy NVDA",
        category: "BUY_SETUP",
        sentiment: "BULLISH",
        relevance: "EXTREME",
        affectedAssets: ["AAPL"],
        keyPoints: [],
        uncertainties: [],
      }).success,
    ).toBe(false);
    expect(AI_SUMMARY_UNAVAILABLE).toBe("AI_SUMMARY_UNAVAILABLE");
  });
});
