export type WatchAsset = {
  symbol: string;
  name: string;
  /**
   * Exact Twelve Data symbol. Null means the provider has no verified
   * instrument for this internal code — do not guess, show UNAVAILABLE.
   */
  providerSymbol: string | null;
  acceptName?: RegExp;
  rejectName?: RegExp;
};

export const MARKET_WATCHLIST: WatchAsset[] = [
  { symbol: "SPY", name: "S&P 500", providerSymbol: "SPY" },
  { symbol: "QQQ", name: "Nasdaq 100", providerSymbol: "QQQ" },
  { symbol: "NVDA", name: "NVIDIA", providerSymbol: "NVDA" },
  { symbol: "BTC", name: "Bitcoin", providerSymbol: "BTC/USD" },
  { symbol: "XAU", name: "Gold", providerSymbol: "XAU/USD" },
  {
    symbol: "USD",
    name: "US Dollar",
    // DXY is not served by Twelve Data. DX is Dynex Capital Inc., not the index.
    providerSymbol: null,
    acceptName: /dollar index/i,
    rejectName: /dynex/i,
  },
];

const ALIASES: Record<string, string> = {
  "BTC/USD": "BTC",
  BITCOIN: "BTC",
  "XAU/USD": "XAU",
  GOLD: "XAU",
  DXY: "USD",
  USDOLLAR: "USD",
};

export function normalizeInternalSymbol(raw: string): string {
  const upper = raw.trim().toUpperCase();
  return ALIASES[upper] ?? upper;
}

export function getWatchAsset(symbol: string): WatchAsset | undefined {
  const internal = normalizeInternalSymbol(symbol);
  return MARKET_WATCHLIST.find((asset) => asset.symbol === internal);
}

export function toProviderSymbol(symbol: string): string | null {
  const internal = normalizeInternalSymbol(symbol);
  const watched = getWatchAsset(internal);
  if (watched) {
    return watched.providerSymbol;
  }
  if (internal === "USD") {
    return null;
  }
  return internal;
}

export function displayNameFor(symbol: string): string {
  return getWatchAsset(symbol)?.name ?? normalizeInternalSymbol(symbol);
}

export function quoteMatchesMapping(
  internalSymbol: string,
  quote: { name: string | null; symbol: string },
): boolean {
  const watched = getWatchAsset(internalSymbol);
  if (!watched) {
    return true;
  }
  const name = quote.name ?? "";
  if (watched.rejectName?.test(name)) {
    return false;
  }
  if (watched.acceptName && !watched.acceptName.test(name)) {
    return false;
  }
  return true;
}
