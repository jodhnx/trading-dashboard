import type { RankedOpportunity } from "./types";
import {
  compareOpportunityRank,
  partitionByQuality,
  selectBestOpportunity,
  whyNoBest,
} from "./ranking";
import { TOP_CRYPTO_LIMIT, TOP_STOCK_LIMIT } from "./types";

function withInferredQuality(item: RankedOpportunity): RankedOpportunity {
  if (
    item.quality === "STRONG" ||
    item.quality === "CONFIRMED" ||
    item.quality === "EARLY_SETUP" ||
    item.quality === "WATCH" ||
    item.quality === "DATA_INSUFFICIENT"
  ) {
    return item;
  }
  if (item.tier === "STRONG_OPPORTUNITY") {
    return { ...item, quality: "STRONG" };
  }
  if (item.tier === "OPPORTUNITY") {
    return { ...item, quality: "CONFIRMED" };
  }
  if (item.tier === "WATCH") {
    return { ...item, quality: "WATCH" };
  }
  return item;
}

/**
 * Rebuild Phase 22 board slices from persisted rows (no provider calls).
 */
export function boardFromStored(opportunities: RankedOpportunity[]) {
  const inferred = opportunities.map(withInferredQuality).sort(compareOpportunityRank);
  const stocks = inferred.filter((item) => item.assetClass !== "CRYPTO");
  const cryptos = inferred.filter((item) => item.assetClass === "CRYPTO");
  const bestStock = selectBestOpportunity(stocks);
  const bestCrypto = selectBestOpportunity(cryptos);
  const parts = partitionByQuality(inferred);

  return {
    bestStock,
    bestCrypto,
    topStocks: inferred
      .filter(
        (item) =>
          item.assetClass !== "CRYPTO" &&
          (item.quality === "STRONG" ||
            item.quality === "CONFIRMED" ||
            item.quality === "EARLY_SETUP" ||
            item.quality === "WATCH"),
      )
      .slice(0, TOP_STOCK_LIMIT),
    topCrypto: inferred
      .filter(
        (item) =>
          item.assetClass === "CRYPTO" &&
          (item.quality === "STRONG" ||
            item.quality === "CONFIRMED" ||
            item.quality === "EARLY_SETUP" ||
            item.quality === "WATCH"),
      )
      .slice(0, TOP_CRYPTO_LIMIT),
    developing: parts.developing,
    watch: parts.watch,
    whyNoBestStock:
      bestStock === null
        ? whyNoBest({
            assetClass: "STOCK",
            candidates: stocks,
            liveOrCached: stocks.filter(
              (i) => i.dataStatus === "LIVE" || i.dataStatus === "CACHED",
            ).length,
          })
        : null,
    whyNoBestCrypto:
      bestCrypto === null
        ? whyNoBest({
            assetClass: "CRYPTO",
            candidates: cryptos,
            liveOrCached: cryptos.filter(
              (i) => i.dataStatus === "LIVE" || i.dataStatus === "CACHED",
            ).length,
          })
        : null,
  };
}
