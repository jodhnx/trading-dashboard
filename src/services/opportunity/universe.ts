import type { AssetType } from "@/types/enums";

/**
 * Bounded opportunity universe for the daily scanner.
 * Expand carefully — each symbol costs provider requests within Vercel cron limits.
 * Illiquid / micro-cap crypto are excluded by default.
 */
export type UniverseAsset = {
  symbol: string;
  name: string;
  assetClass: "STOCK" | "CRYPTO" | "ETF" | "COMMODITY" | "INDEX";
  assetType: AssetType;
  /** Exact Twelve Data symbol. Null → DATA UNAVAILABLE (never guess). */
  providerSymbol: string | null;
  /** Minimum relative volume heuristic weight (documentation / future filters). */
  minLiquidityTier: "HIGH" | "MEDIUM";
  exchange?: string;
  currency?: string;
};

export const OPPORTUNITY_UNIVERSE: UniverseAsset[] = [
  // Benchmarks / ETFs
  { symbol: "SPY", name: "S&P 500 ETF", assetClass: "ETF", assetType: "ETF", providerSymbol: "SPY", minLiquidityTier: "HIGH", exchange: "NYSEARCA" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", assetClass: "ETF", assetType: "ETF", providerSymbol: "QQQ", minLiquidityTier: "HIGH", exchange: "NASDAQ" },
  { symbol: "IWM", name: "Russell 2000 ETF", assetClass: "ETF", assetType: "ETF", providerSymbol: "IWM", minLiquidityTier: "HIGH", exchange: "NYSEARCA" },
  { symbol: "XLK", name: "Technology Select Sector", assetClass: "ETF", assetType: "ETF", providerSymbol: "XLK", minLiquidityTier: "HIGH", exchange: "NYSEARCA" },
  { symbol: "XLF", name: "Financial Select Sector", assetClass: "ETF", assetType: "ETF", providerSymbol: "XLF", minLiquidityTier: "HIGH", exchange: "NYSEARCA" },
  { symbol: "XLE", name: "Energy Select Sector", assetClass: "ETF", assetType: "ETF", providerSymbol: "XLE", minLiquidityTier: "HIGH", exchange: "NYSEARCA" },
  // Large-cap / growth / semis
  { symbol: "AAPL", name: "Apple", assetClass: "STOCK", assetType: "STOCK", providerSymbol: "AAPL", minLiquidityTier: "HIGH", exchange: "NASDAQ" },
  { symbol: "MSFT", name: "Microsoft", assetClass: "STOCK", assetType: "STOCK", providerSymbol: "MSFT", minLiquidityTier: "HIGH", exchange: "NASDAQ" },
  { symbol: "NVDA", name: "NVIDIA", assetClass: "STOCK", assetType: "STOCK", providerSymbol: "NVDA", minLiquidityTier: "HIGH", exchange: "NASDAQ" },
  { symbol: "AMZN", name: "Amazon", assetClass: "STOCK", assetType: "STOCK", providerSymbol: "AMZN", minLiquidityTier: "HIGH", exchange: "NASDAQ" },
  { symbol: "META", name: "Meta Platforms", assetClass: "STOCK", assetType: "STOCK", providerSymbol: "META", minLiquidityTier: "HIGH", exchange: "NASDAQ" },
  { symbol: "TSLA", name: "Tesla", assetClass: "STOCK", assetType: "STOCK", providerSymbol: "TSLA", minLiquidityTier: "HIGH", exchange: "NASDAQ" },
  { symbol: "AMD", name: "Advanced Micro Devices", assetClass: "STOCK", assetType: "STOCK", providerSymbol: "AMD", minLiquidityTier: "HIGH", exchange: "NASDAQ" },
  { symbol: "JPM", name: "JPMorgan Chase", assetClass: "STOCK", assetType: "STOCK", providerSymbol: "JPM", minLiquidityTier: "HIGH", exchange: "NYSE" },
  { symbol: "XOM", name: "Exxon Mobil", assetClass: "STOCK", assetType: "STOCK", providerSymbol: "XOM", minLiquidityTier: "HIGH", exchange: "NYSE" },
  { symbol: "UNH", name: "UnitedHealth", assetClass: "STOCK", assetType: "STOCK", providerSymbol: "UNH", minLiquidityTier: "HIGH", exchange: "NYSE" },
  // Crypto (liquid majors only)
  { symbol: "BTC", name: "Bitcoin", assetClass: "CRYPTO", assetType: "CRYPTO", providerSymbol: "BTC/USD", minLiquidityTier: "HIGH", exchange: "Crypto" },
  { symbol: "ETH", name: "Ethereum", assetClass: "CRYPTO", assetType: "CRYPTO", providerSymbol: "ETH/USD", minLiquidityTier: "HIGH", exchange: "Crypto" },
  { symbol: "SOL", name: "Solana", assetClass: "CRYPTO", assetType: "CRYPTO", providerSymbol: "SOL/USD", minLiquidityTier: "HIGH", exchange: "Crypto" },
  { symbol: "XRP", name: "XRP", assetClass: "CRYPTO", assetType: "CRYPTO", providerSymbol: "XRP/USD", minLiquidityTier: "HIGH", exchange: "Crypto" },
  { symbol: "LINK", name: "Chainlink", assetClass: "CRYPTO", assetType: "CRYPTO", providerSymbol: "LINK/USD", minLiquidityTier: "MEDIUM", exchange: "Crypto" },
  // Commodity / FX index
  { symbol: "XAU", name: "Gold", assetClass: "COMMODITY", assetType: "COMMODITY", providerSymbol: "XAU/USD", minLiquidityTier: "HIGH", exchange: "FOREXCOM" },
  {
    symbol: "USD",
    name: "US Dollar Index",
    assetClass: "INDEX",
    assetType: "INDEX",
    providerSymbol: null,
    minLiquidityTier: "HIGH",
    exchange: "CBOE",
  },
];

export const REGIME_BENCHMARKS = ["SPY", "QQQ", "IWM", "BTC", "ETH"] as const;

export function getUniverseAsset(symbol: string): UniverseAsset | undefined {
  const upper = symbol.trim().toUpperCase();
  return OPPORTUNITY_UNIVERSE.find((asset) => asset.symbol === upper);
}

export function listUniverseSymbols(): string[] {
  return OPPORTUNITY_UNIVERSE.map((asset) => asset.symbol);
}

export function listStockUniverse(): UniverseAsset[] {
  return OPPORTUNITY_UNIVERSE.filter(
    (asset) =>
      asset.assetClass === "STOCK" ||
      asset.assetClass === "ETF" ||
      asset.assetClass === "INDEX" ||
      asset.assetClass === "COMMODITY",
  );
}

export function listCryptoUniverse(): UniverseAsset[] {
  return OPPORTUNITY_UNIVERSE.filter((asset) => asset.assetClass === "CRYPTO");
}

export function isCryptoSymbol(symbol: string): boolean {
  return getUniverseAsset(symbol)?.assetClass === "CRYPTO";
}
