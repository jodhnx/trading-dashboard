import type { Timeframe } from "@/types/enums";

/** In-memory cache TTLs. Quotes stay short; daily bars can live longer. */
export const MARKET_CACHE_TTL_MS = {
  quote: 30_000,
  candlesIntraday: 60_000,
  candlesDaily: 15 * 60_000,
  candlesWeekly: 60 * 60_000,
} as const;

/** Age of provider timestamps after which UI must show STALE while the session is open. */
export const MARKET_STALE_AFTER_MS = {
  quoteOpen: 15 * 60_000,
  crypto: 15 * 60_000,
  candlesIntraday: 30 * 60_000,
  candlesDaily: 26 * 60 * 60_000,
  closedSession: {
    us_equity: 5 * 24 * 60 * 60_000,
    crypto: 15 * 60_000,
    metals: 3 * 24 * 60 * 60_000,
    fx: 3 * 24 * 60 * 60_000,
  },
} as const;

export const PROVIDER_TIMEOUT_MS = 10_000;
export const MAX_CANDLE_LIMIT = 1000;
export const DEFAULT_CANDLE_LIMIT = 200;
/** Enough bars for EMA 200 plus MACD signal and swing structure. */
export const TECHNICAL_CANDLE_LIMIT = 300;

export function candleTtlMs(timeframe: Timeframe): number {
  if (timeframe === "1week") {
    return MARKET_CACHE_TTL_MS.candlesWeekly;
  }
  if (timeframe === "1day") {
    return MARKET_CACHE_TTL_MS.candlesDaily;
  }
  return MARKET_CACHE_TTL_MS.candlesIntraday;
}

export function quoteStaleAfterMs(): number {
  return MARKET_STALE_AFTER_MS.quoteOpen;
}

export function candleStaleAfterMs(timeframe: Timeframe): number {
  if (timeframe === "1day" || timeframe === "1week") {
    return MARKET_STALE_AFTER_MS.candlesDaily;
  }
  return MARKET_STALE_AFTER_MS.candlesIntraday;
}
