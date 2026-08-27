export const CATALOG_CATEGORIES = [
  "US_LARGE_CAP",
  "US_MID_CAP",
  "US_SMALL_CAP",
  "AI",
  "SEMICONDUCTOR",
  "SOFTWARE",
  "CLOUD",
  "CYBERSECURITY",
  "FINANCIAL",
  "FINTECH",
  "ENERGY",
  "HEALTHCARE",
  "CONSUMER",
  "INDUSTRIAL",
  "DEFENSE",
  "CRYPTO",
  "ETF",
  "SECTOR_ETF",
  "LEVERAGED_ETF",
] as const;

export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

const CATEGORY_SECTOR: Partial<Record<CatalogCategory, string>> = {
  AI: "Technology",
  SEMICONDUCTOR: "Technology",
  SOFTWARE: "Technology",
  CLOUD: "Technology",
  CYBERSECURITY: "Technology",
  FINANCIAL: "Financials",
  FINTECH: "Financials",
  ENERGY: "Energy",
  HEALTHCARE: "Health Care",
  CONSUMER: "Consumer Discretionary",
  INDUSTRIAL: "Industrials",
  DEFENSE: "Industrials",
  US_LARGE_CAP: "Broad Market",
  US_MID_CAP: "Mid Cap",
  US_SMALL_CAP: "Small Cap",
  ETF: "ETF",
  SECTOR_ETF: "Sector ETF",
  LEVERAGED_ETF: "Leveraged ETF",
  CRYPTO: "Digital Assets",
};

export function sectorForCategory(category: CatalogCategory): string | null {
  return CATEGORY_SECTOR[category] ?? null;
}

export function riskHintsForCategory(
  category: CatalogCategory,
  leveraged = false,
): string[] {
  const hints: string[] = [];
  if (leveraged || category === "LEVERAGED_ETF") {
    hints.push("LEVERAGED", "EXTREME_VOLATILITY");
  }
  if (category === "CRYPTO") {
    hints.push("CRYPTO_VOLATILITY");
  }
  if (category === "US_SMALL_CAP") {
    hints.push("SMALL_CAP_LIQUIDITY");
  }
  if (category === "FINTECH" || category === "AI") {
    hints.push("THEMATIC_GROWTH");
  }
  if (category === "DEFENSE") {
    hints.push("GEOPOLITICAL_SENSITIVITY");
  }
  return hints;
}
