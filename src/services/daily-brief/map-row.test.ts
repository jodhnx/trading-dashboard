import { describe, expect, it } from "vitest";
import { briefFromRow, toBriefInsertRow } from "./map-row";
import type { DailyBriefInputSnapshot } from "./types";
import type { DailyBriefRow } from "@/types/database";

describe("daily brief row mapping", () => {
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
        reasons: [],
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
        reasons: [],
      },
    ],
    watchlist: [],
    noTradeAssets: [],
    risks: ["No news"],
    dataStatus: "LIVE",
    newsStatus: "UNAVAILABLE",
    aiStatus: "ok",
    model: "gpt-4o-mini",
    promptVersion: "daily-brief-summary-v1",
  };

  it("stores input snapshot without secrets", () => {
    const row = toBriefInsertRow({
      userId: "user-1",
      briefDate: "2026-08-25",
      marketRegime: "RISK_ON",
      riskEnvironment: "NORMAL",
      summary: "Summary",
      finalStatus: "TRADE",
      snapshot,
      model: "gpt-4o-mini",
      promptVersion: "daily-brief-summary-v1",
      aiStatus: "ok",
      isMock: false,
      generatedAt: snapshot.generatedAt,
    });
    const json = JSON.stringify(row);
    expect(row.input_snapshot).toBeTruthy();
    expect(row.top_opportunities).toEqual(snapshot.topOpportunities);
    expect(json).not.toMatch(/OPENAI_API_KEY|sk-|SUPABASE_SECRET/);
    expect(
      (row.top_opportunities as Array<{ entry: number }>)[0]?.entry,
    ).toBe(100);
  });

  it("round-trips a persisted row", () => {
    const inserted = toBriefInsertRow({
      userId: "user-1",
      briefDate: "2026-08-25",
      marketRegime: "RISK_ON",
      riskEnvironment: "NORMAL",
      summary: "Summary",
      finalStatus: "TRADE",
      snapshot,
      model: "gpt-4o-mini",
      promptVersion: "daily-brief-summary-v1",
      aiStatus: "ok",
      isMock: false,
      generatedAt: snapshot.generatedAt,
    });
    const row = {
      id: "brief-1",
      created_at: snapshot.generatedAt,
      ...inserted,
    } as unknown as DailyBriefRow;
    const restored = briefFromRow(row, new Date("2026-08-25T13:00:00.000Z"));
    expect(restored.finalStatus).toBe("TRADE");
    expect(restored.topOpportunities[0]?.entry).toBe(100);
    expect(restored.topOpportunities[0]?.stopLoss).toBe(95);
    expect(restored.topOpportunities[0]?.takeProfit).toBe(110);
    expect(restored.topOpportunities[0]?.positionSize).toBe(20);
  });
});
