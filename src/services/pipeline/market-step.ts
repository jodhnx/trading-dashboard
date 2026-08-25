import "server-only";

import { createMarketDataService } from "@/services/market/create-service";
import { MARKET_WATCHLIST } from "@/services/market/symbols";
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
 * Warm shared market cache + persistence for all watchlist assets once per pipeline run.
 * Subsequent assemble/getQuote/getTechnicalSnapshot calls reuse cached results.
 */
export async function warmMarketData(): Promise<MarketWarmResult> {
  const market = createMarketDataService();
  const assets: PipelineAssetResult[] = [];
  const counts = { live: 0, cached: 0, stale: 0, mock: 0, unavailable: 0 };

  for (const asset of MARKET_WATCHLIST) {
    try {
      invalidateMarketSymbolCache(asset.symbol, DAILY_BRIEF_TIMEFRAME);
      const quote = await market.getQuote(asset.symbol);
      const technical = await market.getTechnicalSnapshot(
        asset.symbol,
        DAILY_BRIEF_TIMEFRAME,
      );
      bumpStatus(counts, quote.status);
      assets.push({
        symbol: asset.symbol,
        quoteStatus: quote.status,
        technicalStatus: technical.snapshot.dataStatus,
      });
    } catch (error) {
      assets.push({
        symbol: asset.symbol,
        quoteStatus: "UNAVAILABLE",
        technicalStatus: "UNAVAILABLE",
        error: error instanceof Error ? error.message : "market_error",
      });
      counts.unavailable += 1;
    }
  }

  return { assets, counts };
}
