import { describe, expect, it } from "vitest";
import { summarizeDailyBrief } from "./summarize";
import type { AssembledBrief } from "./assemble";
import type { DailyBriefInputSnapshot } from "./types";
import { MockOpenAiClient } from "@/ai/client";

function assembled(): AssembledBrief {
  const snapshot: DailyBriefInputSnapshot = {
    briefDate: "2026-08-25",
    timezone: "UTC",
    timeframe: "1day",
    generatedAt: "2026-08-25T12:00:00.000Z",
    symbols: ["NVDA"],
    marketOverview: [],
    technicalConditions: [],
    tradingSetups: [
      {
        symbol: "NVDA",
        direction: "LONG",
        status: "VALID",
        score: 70,
        entry: 100,
        stopLoss: 95,
        takeProfit: 110,
        riskReward: 2,
        positionSize: 20,
        riskAmount: 100,
        reasons: ["Bullish"],
        rejectReasons: [],
        dataStatus: "LIVE",
      },
    ],
    importantNews: [],
    macroEvents: [],
    aiAnalyses: [],
    topOpportunities: [
      {
        symbol: "NVDA",
        direction: "LONG",
        status: "VALID",
        score: 70,
        entry: 100,
        stopLoss: 95,
        takeProfit: 110,
        riskReward: 2,
        positionSize: 20,
        riskAmount: 100,
        reasons: ["Bullish"],
      },
    ],
    watchlist: [],
    noTradeAssets: [],
    risks: ["No news"],
    dataStatus: "LIVE",
    newsStatus: "UNAVAILABLE",
    aiStatus: "SKIPPED",
    model: null,
    promptVersion: "daily-brief-v1",
  };
  return {
    snapshot,
    marketRegime: "RISK_ON",
    riskEnvironment: "NORMAL",
    summary: "Deterministic summary",
    finalStatus: "TRADE",
  };
}

describe("summarizeDailyBrief", () => {
  it("keeps deterministic summary when OpenAI is unavailable", async () => {
    const result = await summarizeDailyBrief({
      assembled: assembled(),
      client: null,
    });
    expect(result.aiStatus).toBe("AI_UNAVAILABLE");
    expect(result.summary).toBe("Deterministic summary");
    expect(result.marketRegime).toBe("RISK_ON");
  });

  it("keeps engine regime when AI returns a summary", async () => {
    const client = new MockOpenAiClient({
      summary: "AI wording only.",
      marketRegime: "SHOULD_NOT_OVERRIDE",
      riskEnvironment: "SHOULD_NOT_OVERRIDE",
      risks: ["AI risk note"],
      notes: ["ok"],
    });
    const result = await summarizeDailyBrief({
      assembled: assembled(),
      client,
    });
    expect(result.aiStatus).toBe("ok");
    expect(result.summary).toBe("AI wording only.");
    expect(result.marketRegime).toBe("RISK_ON");
    expect(result.riskEnvironment).toBe("NORMAL");
    expect(result.risks).toContain("No news");
    expect(result.risks).toContain("AI risk note");
  });

  it("falls back on invalid AI JSON", async () => {
    const client = new MockOpenAiClient({ summary: "" });
    const result = await summarizeDailyBrief({
      assembled: assembled(),
      client,
    });
    expect(result.aiStatus).toBe("AI_ANALYSIS_INVALID");
    expect(result.summary).toBe("Deterministic summary");
  });

  it("maps AI timeout without inventing setups", async () => {
    const result = await summarizeDailyBrief({
      assembled: assembled(),
      client: {
        isMock: true,
        model: "mock",
        completeStructured: async () => ({ status: "AI_TIMEOUT" }),
      },
    });
    expect(result.aiStatus).toBe("AI_TIMEOUT");
    expect(result.summary).toBe("Deterministic summary");
  });
});
