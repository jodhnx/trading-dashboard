import type { TradingStyle } from "./enums";

/** Defaults match the SQL user_settings table. Never hardcode these in the engine. */
export const USER_SETTINGS_DEFAULTS = {
  capital: 10000,
  baseCurrency: "EUR",
  riskPerTrade: 0.005,
  maxDailyRisk: 0.015,
  maxPortfolioExposure: 0.2,
  minimumRiskReward: 2,
  minimumAiScore: 7,
  maxOpenPositions: 5,
  tradingStyle: "SWING" as TradingStyle,
  preferredMarkets: ["STOCKS", "ETFS", "CRYPTO", "INDICES", "COMMODITIES"],
} as const;

export const PREFERRED_MARKET_OPTIONS = [
  "STOCKS",
  "ETFS",
  "CRYPTO",
  "INDICES",
  "COMMODITIES",
] as const;

export type PreferredMarket = (typeof PREFERRED_MARKET_OPTIONS)[number];

export const BASE_CURRENCIES = ["EUR", "USD", "CHF", "GBP"] as const;
export type BaseCurrency = (typeof BASE_CURRENCIES)[number];

export const TRADING_STYLE_LABELS: Record<TradingStyle, string> = {
  SCALP: "Scalping",
  DAY: "Day Trading",
  SWING: "Swing Trading",
  POSITION: "Position Trading",
};
