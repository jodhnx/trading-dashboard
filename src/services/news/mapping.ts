import { MARKET_WATCHLIST, normalizeInternalSymbol } from "@/services/market/symbols";

/**
 * High-confidence asset mapping only. If zero or more than one watchlist
 * symbol matches, asset_id stays null — no guessing.
 *
 * NVIDIA / NVDA → NVDA
 * Bitcoin (not a lone "BTC" token in unrelated tickers) → BTC
 * S&P 500 / SPDR S&P → SPY
 * Nasdaq-100 / Invesco QQQ → QQQ
 * gold price / spot gold / XAU → XAU
 * US dollar index / DXY → USD
 * Fed / FOMC / Powell without a unique company → no asset
 */
const ASSET_RULES: Array<{ symbol: string; pattern: RegExp }> = [
  { symbol: "NVDA", pattern: /\b(nvidia|nvda)\b/i },
  { symbol: "BTC", pattern: /\b(bitcoin)\b/i },
  { symbol: "SPY", pattern: /\b(s&p 500|spdr s&p|spy etf)\b/i },
  { symbol: "QQQ", pattern: /\b(nasdaq-100|nasdaq 100|invesco qqq)\b/i },
  { symbol: "XAU", pattern: /\b(xau|spot gold|gold prices?)\b/i },
  { symbol: "USD", pattern: /\b(us dollar index|dxy)\b/i },
];

export type AssetMapping = {
  symbols: string[];
  uniqueSymbol: string | null;
};

export function mapNewsAssets(text: string): AssetMapping {
  const symbols = ASSET_RULES.filter((rule) => rule.pattern.test(text)).map(
    (rule) => rule.symbol,
  );
  const unique = [...new Set(symbols)];
  if (unique.length !== 1) {
    return { symbols: [], uniqueSymbol: null };
  }
  return { symbols: unique, uniqueSymbol: unique[0]! };
}

export function isWatchlistSymbol(symbol: string): boolean {
  const internal = normalizeInternalSymbol(symbol);
  return MARKET_WATCHLIST.some((asset) => asset.symbol === internal);
}

export const ASSET_NEWS_QUERY: Record<string, string> = {
  NVDA: "NVIDIA",
  BTC: "Bitcoin",
  SPY: '"S&P 500" OR "SPDR S&P 500"',
  QQQ: '"Nasdaq-100" OR "Invesco QQQ"',
  XAU: '"gold price" OR "spot gold"',
  USD: '"US dollar index" OR DXY',
};

export function newsQueryForAsset(symbol: string): string | null {
  const internal = normalizeInternalSymbol(symbol);
  return ASSET_NEWS_QUERY[internal] ?? null;
}
