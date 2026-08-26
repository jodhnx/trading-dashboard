import type { CatalogAsset } from "@/services/universe/types";
import {
  BROAD_MARKET_CATALOG,
  catalogSize,
  getCatalogAsset,
  listCryptoCatalog,
  listEtfCatalog,
  listStockCatalog,
  listTradableCatalog,
  REGIME_BENCHMARKS,
} from "@/services/universe/catalog";

export type UniverseAsset = CatalogAsset & {
  minLiquidityTier: CatalogAsset["liquidityTier"];
};

function toUniverseAsset(asset: CatalogAsset): UniverseAsset {
  return { ...asset, minLiquidityTier: asset.liquidityTier };
}

/** Backward-compatible export — now backed by broad catalog. */
export const OPPORTUNITY_UNIVERSE: UniverseAsset[] = BROAD_MARKET_CATALOG.map(
  toUniverseAsset,
);

export { REGIME_BENCHMARKS, catalogSize, getCatalogAsset };

export function getUniverseAsset(symbol: string): UniverseAsset | undefined {
  const asset = getCatalogAsset(symbol);
  return asset ? toUniverseAsset(asset) : undefined;
}

export function listUniverseSymbols(): string[] {
  return listTradableCatalog().map((a) => a.symbol);
}

export function listStockUniverse(): UniverseAsset[] {
  return listStockCatalog().map(toUniverseAsset);
}

export function listCryptoUniverse(): UniverseAsset[] {
  return listCryptoCatalog().map(toUniverseAsset);
}

export function listEtfUniverse(): UniverseAsset[] {
  return listEtfCatalog().map(toUniverseAsset);
}

export function isCryptoSymbol(symbol: string): boolean {
  return getCatalogAsset(symbol)?.assetClass === "CRYPTO";
}

/**
 * Load scan universe — catalog-first, paginated for large scans.
 */
export function loadScanUniverse(input?: {
  assetClass?: "STOCK" | "CRYPTO" | "ETF" | "ALL";
  offset?: number;
  limit?: number;
}): CatalogAsset[] {
  let assets = listTradableCatalog();
  if (input?.assetClass && input.assetClass !== "ALL") {
    if (input.assetClass === "ETF") {
      assets = listEtfCatalog();
    } else if (input.assetClass === "CRYPTO") {
      assets = listCryptoCatalog();
    } else {
      assets = assets.filter((a) => a.assetClass === "STOCK");
    }
  }
  const offset = input?.offset ?? 0;
  const limit = input?.limit ?? assets.length;
  return assets.slice(offset, offset + limit);
}

export type { CatalogAsset };
