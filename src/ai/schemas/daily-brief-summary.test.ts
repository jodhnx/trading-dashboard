import { describe, expect, it } from "vitest";
import { dailyBriefSummarySchema } from "@/ai/schemas/daily-brief-summary";

describe("daily brief summary schema", () => {
  it("accepts a valid summary payload", () => {
    expect(
      dailyBriefSummarySchema.safeParse({
        summary: "Cautious day with limited edge.",
        marketRegime: "MIXED",
        riskEnvironment: "CAUTIOUS",
        risks: ["News coverage thin"],
        notes: ["Engine remains authoritative"],
      }).success,
    ).toBe(true);
  });

  it("rejects an empty summary", () => {
    expect(
      dailyBriefSummarySchema.safeParse({
        summary: " ",
        marketRegime: "MIXED",
        riskEnvironment: "CAUTIOUS",
        risks: [],
        notes: [],
      }).success,
    ).toBe(false);
  });
});
