import type { CatalogAsset } from "@/services/universe/types";
import { getCatalogAsset } from "@/services/universe/catalog";
import type { RankedOpportunity } from "./types";

export type SectorExposureWarning = {
  type: "SECTOR_CONCENTRATION";
  sector: string;
  symbols: string[];
  message: string;
  /** Not measured correlation — sector/category overlap only. */
  measuredCorrelation: false;
};

const SEMICONDUCTOR_SYMBOLS = new Set([
  "NVDA",
  "AMD",
  "AVGO",
  "INTC",
  "QCOM",
  "TXN",
  "MU",
  "AMAT",
  "LRCX",
  "KLAC",
  "MRVL",
  "SMCI",
  "ARM",
  "ON",
  "MCHP",
  "NXPI",
  "ADI",
  "ASML",
  "TSM",
]);

const SEMICONDUCTOR_CATEGORIES = new Set([
  "SEMICONDUCTOR",
  "AI",
]);

function sectorForSymbol(symbol: string): string | null {
  const asset = getCatalogAsset(symbol);
  if (!asset) return null;
  if (asset.sector) return asset.sector;
  if (asset.category && SEMICONDUCTOR_CATEGORIES.has(asset.category)) {
    return "Technology";
  }
  if (SEMICONDUCTOR_SYMBOLS.has(symbol)) return "Technology";
  return null;
}

function exposureGroupFor(asset: CatalogAsset | undefined, symbol: string): string | null {
  if (!asset) {
    if (SEMICONDUCTOR_SYMBOLS.has(symbol)) return "Semiconductor";
    return sectorForSymbol(symbol);
  }
  if (asset.category === "SEMICONDUCTOR" || SEMICONDUCTOR_SYMBOLS.has(symbol)) {
    return "Semiconductor";
  }
  if (asset.category === "CRYPTO") return "Digital Assets";
  if (asset.category === "LEVERAGED_ETF") return "Leveraged ETF";
  if (asset.sector) return asset.sector;
  return null;
}

/**
 * Sector/category concentration warnings for actionable and developing candidates.
 * Does not compute statistical price correlation — overlap metadata only.
 */
export function computeSectorExposureWarnings(
  candidates: RankedOpportunity[],
  minOverlap = 2,
): SectorExposureWarning[] {
  const relevant = candidates.filter(
    (item) =>
      item.tradeStatus === "ELIGIBLE" ||
      item.quality === "STRONG" ||
      item.quality === "CONFIRMED" ||
      item.quality === "EARLY_SETUP" ||
      item.boardQuality === "TRADE" ||
      item.boardQuality === "DEVELOPING",
  );

  const byGroup = new Map<string, string[]>();
  for (const item of relevant) {
    const asset = getCatalogAsset(item.symbol);
    const group = exposureGroupFor(asset, item.symbol);
    if (!group) continue;
    const list = byGroup.get(group) ?? [];
    list.push(item.symbol);
    byGroup.set(group, list);
  }

  const warnings: SectorExposureWarning[] = [];
  for (const [group, symbols] of byGroup) {
    const unique = [...new Set(symbols)];
    if (unique.length < minOverlap) continue;
    warnings.push({
      type: "SECTOR_CONCENTRATION",
      sector: group,
      symbols: unique,
      message: `Sector exposure warning: ${unique.length} candidates share ${group} exposure (${unique.join(", ")}). This is category overlap, not measured price correlation.`,
      measuredCorrelation: false,
    });
  }
  return warnings.sort((a, b) => b.symbols.length - a.symbols.length);
}

export function sectorExposureForSymbol(symbol: string): {
  sector: string | null;
  category: CatalogAsset["category"] | null;
} {
  const asset = getCatalogAsset(symbol);
  return {
    sector: asset?.sector ?? sectorForSymbol(symbol),
    category: asset?.category ?? null,
  };
}
