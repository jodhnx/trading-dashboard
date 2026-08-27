import type { AssetType } from "@/types/enums";
import type { CatalogCategory } from "./catalog-categories";

export type LiquidityTier = "HIGH" | "MEDIUM" | "LOW";

export type CatalogAsset = {
  symbol: string;
  name: string;
  assetType: AssetType;
  assetClass: "STOCK" | "CRYPTO" | "ETF" | "COMMODITY" | "INDEX";
  providerSymbol: string | null;
  exchange?: string;
  country?: string;
  currency?: string;
  market?: string;
  marketCap?: number | null;
  averageVolume?: number | null;
  tradable: boolean;
  providerMapped: boolean;
  liquidityTier: LiquidityTier;
  isLeveragedEtf?: boolean;
  isHighRisk?: boolean;
  /** Phase 27 — structured catalog category for sector exposure and scanning. */
  category?: CatalogCategory;
  sector?: string;
  industry?: string;
  riskHints?: string[];
};

export const DISCOVERY_SIGNALS = [
  "UNUSUAL_VOLUME",
  "STRONG_MOMENTUM",
  "BREAKOUT",
  "NEWS_CATALYST",
  "SECTOR_STRENGTH",
  "VOLATILITY_EXPANSION",
  "RELATIVE_STRENGTH",
  "NEW_HIGH",
  "NEW_LOW",
  "large_daily_move",
  "momentum_move",
  "high_volume",
  "elevated_volume",
  "crypto_volatility",
  "leveraged_etf",
  "high_risk_asset",
] as const;

export type BroadScreenResult = {
  symbol: string;
  asset: CatalogAsset;
  quoteStatus: string;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  screenScore: number;
  skipReason: string | null;
  signals: string[];
};

export type ScanStageStats = {
  universeSize: number;
  broadScreenRequested: number;
  broadScreened: number;
  broadSkipped: number;
  deepAnalyzed: number;
  deepSkipped: number;
  providerCalls: number;
  rateLimitTrips: number;
  skipReasons: Record<string, number>;
};
