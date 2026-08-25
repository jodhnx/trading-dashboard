import { quoteCache, candleCache } from "@/services/market/cache";
import { TECHNICAL_CANDLE_LIMIT } from "@/services/market/ttl";
import { normalizeInternalSymbol } from "@/services/market/symbols";
import type { Timeframe } from "@/types/enums";

export function invalidateMarketSymbolCache(
  symbol: string,
  timeframe: Timeframe = "1day",
): void {
  const internal = normalizeInternalSymbol(symbol);
  quoteCache.delete(`quote:${internal}`);

  for (const limit of [200, TECHNICAL_CANDLE_LIMIT]) {
    candleCache.delete(`candles:${internal}:${timeframe}:${limit}`);
  }
}
