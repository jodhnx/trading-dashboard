import "server-only";

import { tryCreateMarketDataProvider } from "./factory";
import { candleCache, quoteCache, technicalCache } from "./cache";
import { MarketDataService } from "./market-data-service";
import type { Candle, Quote } from "./provider";
import type { MemoryCache } from "./cache";
import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import {
  loadCandles,
  loadLatestQuote,
  persistCandles,
  persistQuote,
} from "./persistence";

export function createMarketDataService(): MarketDataService {
  return new MarketDataService(
    tryCreateMarketDataProvider(),
    quoteCache as MemoryCache<Quote>,
    candleCache as MemoryCache<Candle[]>,
    {
      persistQuote,
      persistCandles,
      loadLatestQuote,
      loadCandles,
    },
    () => new Date(),
    technicalCache as MemoryCache<TechnicalSnapshot>,
  );
}
