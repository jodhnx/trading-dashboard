import { describe, expect, it } from "vitest";
import { USER_SETTINGS_DEFAULTS } from "@/types/settings";
import {
  fractionToPercent,
  parsePreferredAssets,
  percentToFraction,
  settingsInputSchema,
  toSettingsRecord,
  toTradingRiskSettings,
} from "./schema";

const validInput = {
  displayName: "Ben",
  baseCurrency: "EUR",
  capital: 10000,
  riskPerTradePercent: 0.5,
  maxDailyRiskPercent: 1.5,
  maxPositionPercent: 20,
  minimumRiskReward: 2,
  minimumAiScore: 7,
  maxOpenPositions: 5,
  tradingStyle: "SWING",
  preferredMarkets: ["STOCKS", "CRYPTO"],
  preferredAssets: ["NVDA"],
};

describe("settings validation", () => {
  it("matches SQL defaults after percent conversion", () => {
    expect(USER_SETTINGS_DEFAULTS.capital).toBe(10000);
    expect(USER_SETTINGS_DEFAULTS.riskPerTrade).toBe(0.005);
    expect(USER_SETTINGS_DEFAULTS.maxDailyRisk).toBe(0.015);
    expect(percentToFraction(0.5)).toBeCloseTo(0.005);
    expect(percentToFraction(1.5)).toBeCloseTo(0.015);
    expect(fractionToPercent(0.005)).toBe(0.5);
  });

  it("accepts the default settings shape", () => {
    const parsed = settingsInputSchema.safeParse(validInput);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const record = toSettingsRecord(parsed.data);
      expect(record.riskPerTrade).toBeCloseTo(0.005);
      expect(record.maxDailyRisk).toBeCloseTo(0.015);
      expect(record.maxPortfolioExposure).toBeCloseTo(0.2);
      expect(record.tradingStyle).toBe("SWING");
    }
  });

  it("rejects non-positive, NaN, and out-of-range values", () => {
    expect(
      settingsInputSchema.safeParse({ ...validInput, capital: 0 }).success,
    ).toBe(false);
    expect(
      settingsInputSchema.safeParse({ ...validInput, capital: -1 }).success,
    ).toBe(false);
    expect(
      settingsInputSchema.safeParse({ ...validInput, capital: "abc" }).success,
    ).toBe(false);
    expect(
      settingsInputSchema.safeParse({ ...validInput, riskPerTradePercent: 0 }).success,
    ).toBe(false);
    expect(
      settingsInputSchema.safeParse({ ...validInput, minimumAiScore: 11 }).success,
    ).toBe(false);
    expect(
      settingsInputSchema.safeParse({ ...validInput, maxOpenPositions: 0 }).success,
    ).toBe(false);
    expect(
      settingsInputSchema.safeParse({ ...validInput, tradingStyle: "YOLO" }).success,
    ).toBe(false);
  });

  it("rejects risk per trade above maximum daily risk", () => {
    const parsed = settingsInputSchema.safeParse({
      ...validInput,
      riskPerTradePercent: 2,
      maxDailyRiskPercent: 1.5,
    });
    expect(parsed.success).toBe(false);
  });

  it("parses preferred assets and rejects invalid tokens", () => {
    expect(parsePreferredAssets("nvda, spy")).toEqual(["NVDA", "SPY"]);
    expect(() => parsePreferredAssets("DROP TABLE")).toThrow(/Invalid asset symbol/);
  });

  it("maps UI percents to engine risk fractions", () => {
    const risk = toTradingRiskSettings({
      capital: 10_000,
      riskPerTradePercent: 1,
      maxPositionPercent: 20,
      minimumRiskReward: 2,
    });
    expect(risk.maxRiskPercent).toBeCloseTo(0.01, 6);
    expect(risk.maxPositionPercent).toBeCloseTo(0.2, 6);
    expect(risk.accountCapital).toBe(10_000);
  });
});
