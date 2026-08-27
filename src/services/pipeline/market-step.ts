import "server-only";

import { createMarketDataService } from "@/services/market/create-service";
import { REGIME_BENCHMARKS } from "@/services/universe/catalog";
import { ProviderRateLimiter } from "@/services/market/rate-limit";
import { DAILY_BRIEF_TIMEFRAME } from "@/services/daily-brief/types";
import type { DataStatus } from "@/services/market/provider";
import { invalidateMarketSymbolCache } from "./cache-invalidation";
import type { PipelineAssetResult } from "./types";

export type MarketWarmResult = {
  assets: PipelineAssetResult[];
  counts: {
    live: number;
    cached: number;
    stale: number;
    mock: number;
    unavailable: number;
  };
};

function bumpStatus(counts: MarketWarmResult["counts"], status: DataStatus | "UNAVAILABLE") {
  if (status === "LIVE") counts.live += 1;
  else if (status === "CACHED") counts.cached += 1;
  else if (status === "STALE") counts.stale += 1;
  else if (status === "MOCK") counts.mock += 1;
  else counts.unavailable += 1;
}

/**
 * Light pipeline warm for regime benchmarks only.
 * Full universe quotes/technicals are fetched in the rate-limited opportunity scan.
 */
export async function warmMarketData(): Promise<MarketWarmResult> {
  const market = createMarketDataService();
  const limiter = new ProviderRateLimiter(48, 150);
  const assets: PipelineAssetResult[] = [];
  const counts = { live: 0, cached: 0, stale: 0, mock: 0, unavailable: 0 };

  for (const symbol of REGIME_BENCHMARKS) {
    if (!limiter.canCall()) {
      assets.push({
        symbol,
        quoteStatus: "UNAVAILABLE",
        technicalStatus: "UNAVAILABLE",
        error: "provider_rate_limit",
      });
      counts.unavailable += 1;
      continue;
    }

    try {
      await limiter.beforeCall();
      invalidateMarketSymbolCache(symbol, DAILY_BRIEF_TIMEFRAME);
      const quote = await market.getQuote(symbol);
      await limiter.beforeCall();
      const technical = await market.getTechnicalSnapshot(
        symbol,
        DAILY_BRIEF_TIMEFRAME,
      );
      bumpStatus(counts, quote.status);
      assets.push({
        symbol,
        quoteStatus: quote.status,
        technicalStatus: technical.snapshot.dataStatus,
      });
    } catch (error) {
      limiter.onError(error);
      assets.push({
        symbol,
        quoteStatus: "UNAVAILABLE",
        technicalStatus: "UNAVAILABLE",
        error: error instanceof Error ? error.message : "market_error",
      });
      counts.unavailable += 1;
    }
  }

  return { assets, counts };
}
