import { z } from "zod";
import { TRADING_STYLES } from "@/types/enums";
import {
  BASE_CURRENCIES,
  PREFERRED_MARKET_OPTIONS,
} from "@/types/settings";
import type { TradingRiskSettings } from "@/engine/trading/types";

const finiteNumber = z.coerce.number().refine(
  (value) => Number.isFinite(value),
  "Value must be a finite number.",
);

const preferredMarketSchema = z.enum(PREFERRED_MARKET_OPTIONS);

export const settingsInputSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, "Display name is required.")
      .max(80, "Display name is too long."),
    baseCurrency: z.enum(BASE_CURRENCIES),
    capital: finiteNumber
      .gt(0, "Capital must be greater than 0.")
      .max(1_000_000_000, "Capital is unrealistically high."),
    riskPerTradePercent: finiteNumber
      .gt(0, "Risk per trade must be greater than 0.")
      .max(10, "Risk per trade cannot exceed 10%."),
    maxDailyRiskPercent: finiteNumber
      .gt(0, "Maximum daily risk must be greater than 0.")
      .max(50, "Maximum daily risk cannot exceed 50%."),
    maxPositionPercent: finiteNumber
      .gt(0, "Max position size must be greater than 0.")
      .max(100, "Max position size cannot exceed 100%."),
    minimumRiskReward: finiteNumber.gt(0, "Minimum R:R must be greater than 0."),
    minimumAiScore: finiteNumber
      .min(0, "Minimum AI score must be at least 0.")
      .max(10, "Minimum AI score cannot exceed 10."),
    maxOpenPositions: z.coerce
      .number()
      .int("Maximum open positions must be a whole number.")
      .min(1, "Maximum open positions must be at least 1.")
      .max(50, "Maximum open positions cannot exceed 50."),
    tradingStyle: z.enum(TRADING_STYLES),
    preferredMarkets: z
      .array(preferredMarketSchema)
      .min(1, "Select at least one market."),
    preferredAssets: z.array(z.string()).max(50),
  })
  .superRefine((value, ctx) => {
    if (value.riskPerTradePercent > value.maxDailyRiskPercent) {
      ctx.addIssue({
        code: "custom",
        path: ["riskPerTradePercent"],
        message: "Risk per trade cannot exceed maximum daily risk.",
      });
    }
  });

export type SettingsInput = z.infer<typeof settingsInputSchema>;

export type SettingsRecord = {
  displayName: string;
  baseCurrency: SettingsInput["baseCurrency"];
  capital: number;
  riskPerTrade: number;
  maxDailyRisk: number;
  maxPortfolioExposure: number;
  minimumRiskReward: number;
  minimumAiScore: number;
  maxOpenPositions: number;
  tradingStyle: SettingsInput["tradingStyle"];
  preferredMarkets: SettingsInput["preferredMarkets"];
  preferredAssets: string[];
};

export type AccountSettings = SettingsInput & {
  email: string | null;
};

const assetTokenSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9./\-_]+$/, "Invalid asset symbol.");

export function parsePreferredAssets(raw: string): string[] {
  const tokens = raw
    .split(/[,\n]/)
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);

  const unique: string[] = [];
  for (const token of tokens) {
    const parsed = assetTokenSchema.safeParse(token);
    if (!parsed.success) {
      throw new Error(`Invalid asset symbol: ${token}`);
    }
    if (!unique.includes(parsed.data)) {
      unique.push(parsed.data);
    }
  }
  return unique;
}

export function percentToFraction(percent: number): number {
  return Number((percent / 100).toFixed(6));
}

export function fractionToPercent(fraction: number): number {
  return Number((fraction * 100).toFixed(4));
}

export function toSettingsRecord(input: SettingsInput): SettingsRecord {
  return {
    displayName: input.displayName,
    baseCurrency: input.baseCurrency,
    capital: input.capital,
    riskPerTrade: percentToFraction(input.riskPerTradePercent),
    maxDailyRisk: percentToFraction(input.maxDailyRiskPercent),
    maxPortfolioExposure: percentToFraction(input.maxPositionPercent),
    minimumRiskReward: input.minimumRiskReward,
    minimumAiScore: input.minimumAiScore,
    maxOpenPositions: input.maxOpenPositions,
    tradingStyle: input.tradingStyle,
    preferredMarkets: input.preferredMarkets,
    preferredAssets: input.preferredAssets,
  };
}

export function coerceFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

export function toTradingRiskSettings(input: {
  capital: number;
  riskPerTradePercent: number;
  maxPositionPercent: number;
  minimumRiskReward: number;
}): TradingRiskSettings {
  return {
    accountCapital: input.capital,
    maxRiskPercent: percentToFraction(input.riskPerTradePercent),
    maxPositionPercent: percentToFraction(input.maxPositionPercent),
    minimumRiskReward: input.minimumRiskReward,
  };
}
