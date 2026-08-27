import type { AssetType } from "@/types/enums";
import type { CatalogAsset, LiquidityTier } from "./types";
import type { CatalogCategory } from "./catalog-categories";
import { riskHintsForCategory, sectorForCategory } from "./catalog-categories";

export type ExpandedCatalogEntry = {
  symbol: string;
  name: string;
  category: CatalogCategory;
  sector?: string;
  industry?: string;
  exchange?: string;
  market?: string;
  tier?: LiquidityTier;
  leveraged?: boolean;
  highRisk?: boolean;
  assetType?: AssetType;
  providerSymbol?: string | null;
  tradable?: boolean;
  providerMapped?: boolean;
};

function assetClassFor(
  assetType: AssetType,
): CatalogAsset["assetClass"] {
  if (assetType === "CRYPTO") return "CRYPTO";
  if (assetType === "ETF") return "ETF";
  if (assetType === "COMMODITY") return "COMMODITY";
  if (assetType === "INDEX") return "INDEX";
  return "STOCK";
}

function assetTypeForEntry(entry: ExpandedCatalogEntry): AssetType {
  if (entry.assetType) return entry.assetType;
  if (
    entry.category === "CRYPTO" ||
    entry.category === "ETF" ||
    entry.category === "SECTOR_ETF" ||
    entry.category === "LEVERAGED_ETF"
  ) {
    if (entry.category === "CRYPTO") return "CRYPTO";
    return "ETF";
  }
  return "STOCK";
}

function defaultExchange(entry: ExpandedCatalogEntry, assetType: AssetType): string {
  if (entry.exchange) return entry.exchange;
  if (assetType === "CRYPTO") return "Crypto";
  if (assetType === "ETF") return "NYSEARCA";
  return "NASDAQ";
}

function defaultProviderSymbol(symbol: string, assetType: AssetType): string | null {
  if (assetType === "CRYPTO") return `${symbol}/USD`;
  return symbol;
}

export function buildCatalogAsset(entry: ExpandedCatalogEntry): CatalogAsset {
  const assetType = assetTypeForEntry(entry);
  const leveraged = entry.leveraged ?? entry.category === "LEVERAGED_ETF";
  const tier = entry.tier ?? (leveraged ? "HIGH" : "MEDIUM");
  const sector = entry.sector ?? sectorForCategory(entry.category) ?? undefined;
  const riskHints = riskHintsForCategory(entry.category, leveraged);

  return {
    symbol: entry.symbol.trim().toUpperCase(),
    name: entry.name,
    assetType,
    assetClass: assetClassFor(assetType),
    providerSymbol:
      entry.providerSymbol !== undefined
        ? entry.providerSymbol
        : defaultProviderSymbol(entry.symbol, assetType),
    exchange: defaultExchange(entry, assetType),
    country: assetType === "CRYPTO" ? "GLOBAL" : "US",
    currency: "USD",
    market: entry.market ?? (assetType === "CRYPTO" ? "CRYPTO" : "US"),
    tradable: entry.tradable ?? true,
    providerMapped: entry.providerMapped ?? true,
    liquidityTier: tier,
    isLeveragedEtf: leveraged,
    isHighRisk: entry.highRisk ?? leveraged ?? entry.category === "LEVERAGED_ETF",
    category: entry.category,
    sector,
    industry: entry.industry,
    riskHints,
  };
}

export function mergeCatalogEntries(
  primary: CatalogAsset[],
  expanded: ExpandedCatalogEntry[],
): CatalogAsset[] {
  const bySymbol = new Map<string, CatalogAsset>();
  for (const asset of primary) {
    bySymbol.set(asset.symbol, asset);
  }
  for (const entry of expanded) {
    const built = buildCatalogAsset(entry);
    if (!bySymbol.has(built.symbol)) {
      bySymbol.set(built.symbol, built);
    }
  }
  return [...bySymbol.values()];
}
