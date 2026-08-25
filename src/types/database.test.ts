import { describe, expect, it } from "vitest";
import { AI_DECISIONS, ANALYSIS_DECISIONS, ASSET_TYPES, TIMEFRAMES } from "@/types/enums";
import { PRIVATE_TABLES, SHARED_TABLES } from "@/types/database";
import { USER_SETTINGS_DEFAULTS } from "@/types/settings";
import { quoteSchema, symbolSchema } from "@/services/market/schemas";

describe("domain types", () => {
  it("locks AI decisions to the allowed set", () => {
    expect([...AI_DECISIONS]).toEqual([
      "BUY_SETUP",
      "SHORT_SETUP",
      "WATCHLIST",
      "WATCH",
      "HOLD",
      "REDUCE",
      "EXIT",
      "NO_TRADE",
    ]);
    expect([...ANALYSIS_DECISIONS]).toEqual([
      "BUY_SETUP",
      "SHORT_SETUP",
      "WATCHLIST",
      "NO_TRADE",
    ]);
  });

  it("covers the planned asset types", () => {
    expect(ASSET_TYPES).toContain("STOCK");
    expect(ASSET_TYPES).toContain("CRYPTO");
    expect(ASSET_TYPES).toContain("COMMODITY");
  });

  it("keeps private and shared tables disjoint", () => {
    const overlap = PRIVATE_TABLES.filter((table) =>
      (SHARED_TABLES as readonly string[]).includes(table),
    );
    expect(overlap).toEqual([]);
    expect(PRIVATE_TABLES).toContain("user_settings");
    expect(PRIVATE_TABLES).toContain("paper_positions");
    expect(PRIVATE_TABLES).toContain("portfolios");
    expect(PRIVATE_TABLES).toContain("portfolio_holdings");
    expect(PRIVATE_TABLES).toContain("paper_accounts");
    expect(SHARED_TABLES).toContain("assets");
    expect(SHARED_TABLES).toContain("news");
  });

  it("uses SQL-aligned user setting defaults", () => {
    expect(USER_SETTINGS_DEFAULTS.capital).toBe(10000);
    expect(USER_SETTINGS_DEFAULTS.riskPerTrade).toBe(0.005);
    expect(USER_SETTINGS_DEFAULTS.maxDailyRisk).toBe(0.015);
    expect(USER_SETTINGS_DEFAULTS.minimumRiskReward).toBe(2);
    expect(USER_SETTINGS_DEFAULTS.minimumAiScore).toBe(7);
  });

  it("rejects invalid market symbols", () => {
    expect(symbolSchema.safeParse("AAPL").success).toBe(true);
    expect(symbolSchema.safeParse("BTC/USD").success).toBe(true);
    expect(symbolSchema.safeParse("drop table").success).toBe(false);
    expect(symbolSchema.safeParse("").success).toBe(false);
  });

  it("validates quote payloads", () => {
    const parsed = quoteSchema.safeParse({
      symbol: "SPY",
      name: "S&P",
      exchange: "NYSEARCA",
      currency: "USD",
      price: 500,
      change: 3,
      changePercent: 0.6,
      open: 499,
      high: 501,
      low: 498,
      previousClose: 497,
      volume: 1,
      timestamp: new Date("2026-08-24T12:00:00.000Z"),
      dataTimestamp: new Date("2026-08-24T12:00:00.000Z"),
      source: "mock",
      isMock: true,
    });
    expect(parsed.success).toBe(true);
    expect(TIMEFRAMES).toContain("1day");
    expect(TIMEFRAMES).toContain("30min");
  });
});
