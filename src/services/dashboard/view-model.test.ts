import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildDecisionCopy,
  mapDecisionStatus,
  mapMarketRegimeLabel,
  mapRiskEnvironmentLabel,
  normalizeMarketOverview,
  toDashboardViewModel,
} from "./view-model";
import type { DailyBriefRecord } from "@/services/daily-brief/types";

function brief(overrides: Partial<DailyBriefRecord> = {}): DailyBriefRecord {
  return {
    id: "b1",
    userId: "user-1",
    briefDate: "2026-08-25",
    timezone: "UTC",
    marketRegime: "MIXED",
    riskEnvironment: "CAUTIOUS",
    summary: "Stored brief summary",
    finalStatus: "NO_TRADE",
    marketOverview: [
      {
        symbol: "NVDA",
        name: "NVIDIA",
        price: 120,
        changePercent: 1.2,
        dataStatus: "LIVE",
        asOf: "2026-08-25T18:00:00.000Z",
        source: "twelve-data",
      },
      {
        symbol: "USD",
        name: "US Dollar",
        price: null,
        changePercent: null,
        dataStatus: "UNAVAILABLE",
        asOf: null,
        source: null,
      },
    ],
    technicalConditions: [
      {
        symbol: "NVDA",
        timeframe: "1day",
        trend: "NEUTRAL",
        momentum: "NEUTRAL",
        volatility: "NORMAL",
        technicalCondition: "MIXED",
        dataStatus: "LIVE",
        asOf: "2026-08-25T18:00:00.000Z",
        snapshot: null,
      },
    ],
    tradingSetups: [],
    importantNews: [],
    macroEvents: [],
    aiAnalyses: [],
    topOpportunities: [],
    watchlist: [],
    noTradeAssets: [
      {
        symbol: "NVDA",
        reasons: ["Trend is neutral"],
        rejectReasons: ["NO_TRADE"],
        dataStatus: "LIVE",
      },
    ],
    risks: ["No relevant news items were available for this brief."],
    dataStatus: "MIXED",
    aiStatus: "AI_UNAVAILABLE",
    model: null,
    promptVersion: "daily-brief-v1",
    isMock: false,
    generatedAt: "2026-08-25T20:00:00.000Z",
    createdAt: "2026-08-25T20:00:00.000Z",
    isStale: false,
    ...overrides,
  };
}

describe("dashboard view-model", () => {
  it("maps brief statuses to dashboard decision labels", () => {
    expect(mapDecisionStatus("NO_TRADE")).toBe("NO_TRADE");
    expect(mapDecisionStatus("WATCH")).toBe("WATCHLIST");
    expect(mapDecisionStatus("TRADE")).toBe("OPPORTUNITY");
  });

  it("maps regime and risk labels without inventing new decisions", () => {
    expect(mapMarketRegimeLabel("RISK_ON")).toBe("BULLISH");
    expect(mapMarketRegimeLabel("RISK_OFF")).toBe("BEARISH");
    expect(mapMarketRegimeLabel(null)).toBe("UNKNOWN");
    expect(mapRiskEnvironmentLabel("NORMAL")).toBe("LOW");
    expect(mapRiskEnvironmentLabel("ELEVATED")).toBe("HIGH");
    expect(mapRiskEnvironmentLabel("DATA_UNAVAILABLE")).toBe("UNKNOWN");
  });

  it("builds NO_TRADE decision copy from stored reasons", () => {
    const copy = buildDecisionCopy(brief());
    expect(copy.title).toBe("NO TRADE");
    expect(copy.detail).toBe("Trend is neutral");
  });

  it("builds WATCHLIST decision copy", () => {
    const copy = buildDecisionCopy(
      brief({
        finalStatus: "WATCH",
        watchlist: [
          {
            symbol: "NVDA",
            reason: "Setup rejected — watch only",
            direction: "LONG",
            status: "REJECTED",
            score: 55,
          },
        ],
        noTradeAssets: [],
      }),
    );
    expect(copy.title).toBe("WATCHLIST");
    expect(copy.detail).toMatch(/Monitor NVDA/);
  });

  it("builds OPPORTUNITY decision and preserves engine values", () => {
    const opportunity = {
      symbol: "NVDA",
      direction: "LONG" as const,
      status: "VALID" as const,
      score: 72.5,
      entry: 210.4,
      stopLoss: 204.2,
      takeProfit: 222.8,
      riskReward: 2,
      positionSize: 9.4,
      riskAmount: 100,
      reasons: ["Bullish trend"],
    };
    const model = toDashboardViewModel({
      brief: brief({
        finalStatus: "TRADE",
        topOpportunities: [opportunity],
        noTradeAssets: [],
      }),
      history: [],
      today: "2026-08-25",
    });
    expect(model.decisionStatus).toBe("OPPORTUNITY");
    expect(model.decisionDetail).toBe("NVDA LONG setup");
    expect(model.opportunities[0]).toEqual(opportunity);
    expect(model.opportunities[0]?.entry).toBe(210.4);
    expect(model.opportunities[0]?.stopLoss).toBe(204.2);
    expect(model.opportunities[0]?.takeProfit).toBe(222.8);
    expect(model.opportunities[0]?.positionSize).toBe(9.4);
  });

  it("keeps USD unavailable without inventing a price", () => {
    const overview = normalizeMarketOverview(brief().marketOverview);
    const usd = overview.find((item) => item.symbol === "USD");
    expect(usd?.price).toBeNull();
    expect(usd?.dataStatus).toBe("UNAVAILABLE");
    expect(overview.map((item) => item.symbol)).toEqual([
      "SPY",
      "QQQ",
      "NVDA",
      "BTC",
      "XAU",
      "USD",
    ]);
  });

  it("surfaces stale and AI unavailable freshness", () => {
    const model = toDashboardViewModel({
      brief: brief({ isStale: true, aiStatus: "AI_UNAVAILABLE" }),
      history: [brief()],
      today: "2026-08-25",
    });
    expect(model.isStale).toBe(true);
    expect(model.dataStatus).toBe("MIXED");
    expect(model.freshness.ai).toBe("AI_UNAVAILABLE");
    expect(model.freshness.news).toBe("UNKNOWN");
    expect(model.history[0]?.label).toBe("Today");
    expect(model.history[0]?.href).toBe("/daily-brief?date=2026-08-25");
  });

  it("handles missing news without inventing headlines", () => {
    const model = toDashboardViewModel({
      brief: brief({ importantNews: [] }),
      history: [],
      today: "2026-08-25",
    });
    expect(model.news).toEqual([]);
  });
});

describe("dashboard page source integrity", () => {
  it("loads only stored brief services and never calls providers on page load", () => {
    const page = readFileSync(
      path.join(process.cwd(), "src/app/(app)/page.tsx"),
      "utf8",
    );
    const load = readFileSync(
      path.join(process.cwd(), "src/services/dashboard/load.ts"),
      "utf8",
    );
    expect(page).toMatch(/loadDashboard/);
    expect(page).not.toMatch(
      /generateDailyBrief|createOpenAiClient|createMarketDataService|createNewsService|openai\.com|NewsAPI|Twelve/,
    );
    expect(load).toMatch(/findBriefByDate/);
    expect(load).toMatch(/listBriefHistory/);
    expect(load).not.toMatch(
      /generateDailyBrief|createOpenAiClient|createMarketDataService|createNewsService/,
    );
  });
});
