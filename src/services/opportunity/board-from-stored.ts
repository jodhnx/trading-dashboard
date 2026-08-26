import type { RankedOpportunity } from "./types";
import {
  compareOpportunityRank,
  partitionByQuality,
  selectBestOpportunity,
  whyNoBest,
} from "./ranking";
import {
  TOP_CRYPTO_LIMIT,
  TOP_STOCK_LIMIT,
  TOP_ETF_LIMIT,
  DISCOVERED_LIMIT,
  SPECULATIVE_LIMIT,
} from "./types";
import { isDiscoveredCandidate, FAMOUS_SYMBOLS } from "./discovery";

function withInferredQuality(item: RankedOpportunity): RankedOpportunity {
  // Never promote NO_TRADE / BLOCKED based on tier alone.
  if (item.tradeStatus === "BLOCKED") {
    return {
      ...item,
      quality: "NO_TRADE",
      technicalConfirmation: item.technicalConfirmation || "STRONG",
    };
  }
  if (
    item.quality === "STRONG" ||
    item.quality === "CONFIRMED" ||
    item.quality === "EARLY_SETUP" ||
    item.quality === "WATCH" ||
    item.quality === "DATA_INSUFFICIENT"
  ) {
    return item;
  }
  if (item.quality === "NO_TRADE") {
    return item;
  }
  if (item.tier === "STRONG_OPPORTUNITY") {
    return { ...item, quality: "STRONG", tradeStatus: "ELIGIBLE" };
  }
  if (item.tier === "OPPORTUNITY") {
    return { ...item, quality: "CONFIRMED", tradeStatus: "ELIGIBLE" };
  }
  if (item.tier === "WATCH") {
    return { ...item, quality: "WATCH", tradeStatus: "NO_TRADE" };
  }
  return item;
}

/**
 * Rebuild Phase 22/23 board slices from persisted rows (no provider calls).
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
          item.assetClass === "STOCK" &&
          item.tradeStatus !== "BLOCKED" &&
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
          item.tradeStatus !== "BLOCKED" &&
          (item.quality === "STRONG" ||
            item.quality === "CONFIRMED" ||
            item.quality === "EARLY_SETUP" ||
            item.quality === "WATCH"),
      )
      .slice(0, TOP_CRYPTO_LIMIT),
    topEtfs: inferred
      .filter(
        (item) =>
          item.assetClass === "ETF" &&
          item.tradeStatus !== "BLOCKED" &&
          (item.quality === "STRONG" ||
            item.quality === "CONFIRMED" ||
            item.quality === "EARLY_SETUP" ||
            item.quality === "WATCH"),
      )
      .slice(0, TOP_ETF_LIMIT),
    discovered: inferred
      .filter((item) =>
        isDiscoveredCandidate({
          tags: (item.discoveryTags ?? []) as import("./discovery").DiscoveryTag[],
          screenScore: item.screenScore ?? 0,
          opportunityScore: item.scores.opportunityScore,
          symbol: item.symbol,
          famousSymbols: FAMOUS_SYMBOLS,
        }),
      )
      .slice(0, DISCOVERED_LIMIT),
    speculative: inferred
      .filter((item) => item.boardQuality === "SPECULATIVE")
      .sort(compareOpportunityRank)
      .slice(0, SPECULATIVE_LIMIT),
    developing: parts.developing,
    blocked: parts.blocked,
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
