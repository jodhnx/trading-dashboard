import { listTradableCatalog } from "@/services/universe/catalog";
import { MARKET_WATCHLIST, normalizeInternalSymbol } from "@/services/market/symbols";

const STATIC_RULES: Array<{ symbol: string; pattern: RegExp }> = [
  { symbol: "NVDA", pattern: /\b(nvidia|nvda)\b/i },
  { symbol: "BTC", pattern: /\b(bitcoin|\$?btc\b)\b/i },
  { symbol: "ETH", pattern: /\b(ethereum|\$?eth\b)\b/i },
  { symbol: "SPY", pattern: /\b(s&p 500|spdr s&p|\bspy\b)\b/i },
  { symbol: "QQQ", pattern: /\b(nasdaq-100|nasdaq 100|invesco qqq|\bqqq\b)\b/i },
  { symbol: "XAU", pattern: /\b(xau|spot gold|gold prices?)\b/i },
  { symbol: "USD", pattern: /\b(us dollar index|dxy)\b/i },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Tickers that collide with common English words in headlines. */
const AMBIGUOUS_TICKERS = new Set([
  "AI",
  "ALL",
  "ARE",
  "CAN",
  "DAY",
  "FOR",
  "HAS",
  "HIGH",
  "IT",
  "KEY",
  "LOW",
  "NET",
  "NEW",
  "NOW",
  "ON",
  "OR",
  "OUT",
  "PATH",
  "REAL",
  "RUN",
  "SO",
  "TEAM",
  "TOP",
  "UP",
  "US",
  "WAY",
  "BOX",
  "APP",
  "BIG",
  "GO",
]);

function buildCatalogRules(): Array<{ symbol: string; pattern: RegExp }> {
  const rules: Array<{ symbol: string; pattern: RegExp }> = [];
  for (const asset of listTradableCatalog()) {
    const symbol = asset.symbol.toUpperCase();
    if (symbol.length < 3) continue;
    if (AMBIGUOUS_TICKERS.has(symbol)) continue;
    rules.push({
      symbol,
      pattern: new RegExp(`\\$${escapeRegex(symbol)}\\b|\\b${escapeRegex(symbol)}\\b`, "i"),
    });
  }
  return rules;
}

let cachedRules: Array<{ symbol: string; pattern: RegExp }> | null = null;

function assetRules(): Array<{ symbol: string; pattern: RegExp }> {
  if (!cachedRules) {
    cachedRules = [...STATIC_RULES, ...buildCatalogRules()];
  }
  return cachedRules;
}

export type AssetMapping = {
  symbols: string[];
  uniqueSymbol: string | null;
};

/** Match all high-confidence symbols mentioned in article text. */
export function mapNewsAssets(text: string): AssetMapping {
  const matched = new Set<string>();
  for (const rule of assetRules()) {
    if (rule.pattern.test(text)) {
      matched.add(rule.symbol);
    }
  }
  const symbols = [...matched];
  return {
    symbols,
    uniqueSymbol: symbols.length === 1 ? symbols[0]! : null,
  };
}

export function isWatchlistSymbol(symbol: string): boolean {
  const internal = normalizeInternalSymbol(symbol);
  return MARKET_WATCHLIST.some((asset) => asset.symbol === internal);
}

export function buildBroadNewsQuery(): string {
  const majors = listTradableCatalog()
    .filter((a) => a.liquidityTier === "HIGH")
    .slice(0, 40)
    .flatMap((a) => {
      const parts = [a.symbol];
      const word = a.name.split(/\s+/)[0];
      if (word && word.length >= 4 && word.toUpperCase() !== a.symbol) {
        parts.push(`"${word}"`);
      }
      return parts;
    });
  const unique = [...new Set(majors)];
  return [
    '"Federal Reserve" OR CPI OR earnings OR guidance OR Bitcoin OR Ethereum',
    ...unique.slice(0, 60),
  ].join(" OR ");
}

export const ASSET_NEWS_QUERY: Record<string, string> = {
  NVDA: "NVIDIA OR NVDA",
  BTC: "Bitcoin OR BTC",
  ETH: "Ethereum OR ETH",
  SPY: '"S&P 500" OR "SPDR S&P 500" OR SPY',
  QQQ: '"Nasdaq-100" OR "Invesco QQQ" OR QQQ',
  XAU: '"gold price" OR "spot gold" OR XAU',
  USD: '"US dollar index" OR DXY',
};

export function newsQueryForAsset(symbol: string): string | null {
  const internal = normalizeInternalSymbol(symbol);
  if (ASSET_NEWS_QUERY[internal]) {
    return ASSET_NEWS_QUERY[internal]!;
  }
  const asset = listTradableCatalog().find((a) => a.symbol === internal);
  if (!asset) return null;
  const word = asset.name.split(/\s+/)[0];
  return word && word.length >= 4
    ? `${internal} OR "${word}"`
    : internal;
}
