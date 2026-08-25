import { describe, expect, it } from "vitest";
import {
  aggregateDataStatus,
  buildNoTradeAssets,
  buildOpportunities,
  collectRisks,
  deriveFinalStatus,
  deterministicSummary,
} from "./classify";
import type { BriefSetupItem } from "./types";

function setup(overrides: Partial<BriefSetupItem> = {}): BriefSetupItem {
  return {
    symbol: "NVDA",
    direction: "LONG",
    status: "VALID",
    score: 72,
    entry: 100,
    stopLoss: 95,
    takeProfit: 110,
    riskReward: 2,
    positionSize: 20,
    riskAmount: 100,
    reasons: ["Bullish trend"],
    rejectReasons: [],
    dataStatus: "LIVE",
    ...overrides,
  };
}

describe("daily brief classification", () => {
  it("preserves Trading Engine entry/stop/target/size on opportunities", () => {
    const engine = setup();
    const opportunities = buildOpportunities([engine]);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]).toMatchObject({
      symbol: "NVDA",
      direction: "LONG",
      entry: 100,
      stopLoss: 95,
      takeProfit: 110,
      riskReward: 2,
      positionSize: 20,
      riskAmount: 100,
    });
  });

  it("does not invent opportunities from NO_TRADE setups", () => {
    const opportunities = buildOpportunities([
      setup({
        direction: "NO_TRADE",
        status: "REJECTED",
        entry: null,
        stopLoss: null,
        takeProfit: null,
        positionSize: null,
        rejectReasons: ["NO_TRADE"],
      }),
    ]);
    expect(opportunities).toEqual([]);
    expect(deriveFinalStatus({
      opportunities,
      watchlist: [],
      dataStatus: "LIVE",
    })).toBe("NO_TRADE");
  });

  it("marks UNAVAILABLE / MOCK as NO_TRADE final status", () => {
    expect(
      deriveFinalStatus({
        opportunities: [
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
        dataStatus: "MOCK",
      }),
    ).toBe("NO_TRADE");
  });

  it("lists NO_TRADE assets explicitly", () => {
    const items = buildNoTradeAssets([
      setup({
        symbol: "BTC",
        direction: "NO_TRADE",
        status: "REJECTED",
        reasons: ["Trend is neutral"],
        rejectReasons: ["NO_TRADE"],
      }),
      setup({
        symbol: "USD",
        direction: "NO_TRADE",
        status: "REJECTED",
        dataStatus: "UNAVAILABLE",
        reasons: [],
        rejectReasons: ["INSUFFICIENT_DATA"],
      }),
    ]);
    expect(items.map((item) => item.symbol)).toEqual(["BTC", "USD"]);
    expect(items[1]?.reasons).toContain("DATA UNAVAILABLE");
  });

  it("aggregates mixed data status", () => {
    expect(aggregateDataStatus(["LIVE", "LIVE"])).toBe("LIVE");
    expect(aggregateDataStatus(["UNAVAILABLE"])).toBe("UNAVAILABLE");
    expect(aggregateDataStatus(["LIVE", "STALE"])).toBe("MIXED");
  });

  it("collects missing-data risks without inventing news", () => {
    const risks = collectRisks({
      dataStatus: "MIXED",
      setups: [setup({ rejectReasons: ["STALE_DATA"] })],
      market: [
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
      newsCount: 0,
      aiAnalyses: [],
    });
    expect(risks.some((item) => /news/i.test(item))).toBe(true);
    expect(risks.some((item) => /USD/.test(item))).toBe(true);
  });

  it("builds a deterministic summary", () => {
    const text = deterministicSummary({
      briefDate: "2026-08-25",
      finalStatus: "NO_TRADE",
      marketRegime: "MIXED",
      riskEnvironment: "CAUTIOUS",
      opportunities: [],
      watchlist: [],
      noTrade: [],
      newsCount: 0,
      dataStatus: "LIVE",
    });
    expect(text).toMatch(/NO_TRADE/);
    expect(text).toMatch(/Trading Engine/);
    expect(text).not.toMatch(/85%|Gewinnchance/i);
  });
});
