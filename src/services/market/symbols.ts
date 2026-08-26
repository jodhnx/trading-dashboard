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
  "ETH/USD": "ETH",
  ETHEREUM: "ETH",
  "SOL/USD": "SOL",
  "XRP/USD": "XRP",
  "LINK/USD": "LINK",
  "BNB/USD": "BNB",
  "DOGE/USD": "DOGE",
  BINANCECOIN: "BNB",
  DOGECOIN: "DOGE",
  "XAU/USD": "XAU",
  GOLD: "XAU",
  DXY: "USD",
  USDOLLAR: "USD",
};

/** Verified Twelve Data mappings beyond MARKET_WATCHLIST (opportunity universe). */
const PROVIDER_MAP: Record<string, string | null> = {
  SPY: "SPY",
  QQQ: "QQQ",
  IWM: "IWM",
  DIA: "DIA",
  XLK: "XLK",
  XLF: "XLF",
  XLE: "XLE",
  AAPL: "AAPL",
  MSFT: "MSFT",
  NVDA: "NVDA",
  AMZN: "AMZN",
  META: "META",
  GOOGL: "GOOGL",
  TSLA: "TSLA",
  AMD: "AMD",
  AVGO: "AVGO",
  NFLX: "NFLX",
  JPM: "JPM",
  V: "V",
  MA: "MA",
  COST: "COST",
  XOM: "XOM",
  UNH: "UNH",
  BTC: "BTC/USD",
  ETH: "ETH/USD",
  SOL: "SOL/USD",
  XRP: "XRP/USD",
  LINK: "LINK/USD",
  BNB: "BNB/USD",
  DOGE: "DOGE/USD",
  XAU: "XAU/USD",
  USD: null,
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
  if (Object.prototype.hasOwnProperty.call(PROVIDER_MAP, internal)) {
    return PROVIDER_MAP[internal] ?? null;
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
