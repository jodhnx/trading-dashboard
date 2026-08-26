import type { AssetType } from "@/types/enums";

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
  marketCap?: number | null;
  averageVolume?: number | null;
  tradable: boolean;
  providerMapped: boolean;
  liquidityTier: LiquidityTier;
  isLeveragedEtf?: boolean;
  isHighRisk?: boolean;
};

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
