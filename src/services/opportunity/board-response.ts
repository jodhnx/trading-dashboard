import "server-only";

import type { RankedOpportunity } from "./types";
import { boardFromStored } from "./board-from-stored";
import { toOpportunityCandidate, toRankedCandidates } from "./present";
import { isActionableOpportunity } from "./actionable";
import { compareTableRank } from "./table-utils";
import { newsImpactLabel } from "./news-impact";
import { computeSectorExposureWarnings } from "./sector-exposure";
import { latestTimestamp } from "./ui-utils";
import { catalogSize } from "@/services/universe/catalog";
import type { ScanBoardState } from "./types";

export function buildOpportunitiesBoardResponse(input: {
  date: string;
  opportunities: RankedOpportunity[];
  boardState: ScanBoardState;
  pipelineMeta: {
    boardState: ScanBoardState | null;
    marketRegime: string | null;
    liveOrCached: number | null;
    scanned: boolean;
    signalReport: import("./signal-diagnostics").SignalDiagnosticsReport | null;
  };
}) {
  const sorted = [...input.opportunities].sort(compareTableRank);
  const board = boardFromStored(sorted);
  const candidates = toRankedCandidates(sorted);
  const actionableTrades = sorted
    .filter((item) => isActionableOpportunity(item))
    .map((item, index) => toOpportunityCandidate(item, index + 1));
  const stocksAnalyzed = sorted.filter((i) => i.assetClass === "STOCK").length;
  const cryptoAnalyzed = sorted.filter((i) => i.assetClass === "CRYPTO").length;
  const etfAnalyzed = sorted.filter((i) => i.assetClass === "ETF").length;
  const highNewsImpact = sorted.filter(
    (i) => newsImpactLabel(i.scores.newsScore) === "HIGH",
  ).length;
  const dataSkippedCount =
    input.pipelineMeta.signalReport?.dataSkipped ??
    sorted.filter((i) => i.quality === "DATA_INSUFFICIENT").length;

  const freshnessCounts = {
    live: sorted.filter((i) => i.dataFreshness === "LIVE").length,
    recent: sorted.filter((i) => i.dataFreshness === "RECENT").length,
    cached: sorted.filter((i) => i.dataFreshness === "CACHED").length,
    stale: sorted.filter((i) => i.dataFreshness === "STALE").length,
    unavailable: sorted.filter((i) => i.dataFreshness === "UNAVAILABLE").length,
  };

  const sectorExposureWarnings = computeSectorExposureWarnings(sorted);
  const lastMarketUpdate = latestTimestamp(
    sorted.map((item) => item.marketUpdatedAt ?? item.technicalCalculatedAt ?? item.scannedAt),
  );
  const lastNewsUpdate = latestTimestamp(
    sorted.flatMap((item) => [
      item.newsUpdatedAt,
      ...item.newsItems.map((n) => n.publishedAt),
    ]),
  );
  const lastAiUpdate = latestTimestamp(sorted.map((item) => item.aiAnalyzedAt));

  return {
    date: input.date,
    boardState: input.boardState,
    marketRegime:
      sorted[0]?.marketRegime ?? input.pipelineMeta.marketRegime ?? "UNKNOWN",
    scanTimestamp: sorted[0]?.scannedAt ?? null,
    lastMarketUpdate,
    lastNewsUpdate,
    lastAiUpdate,
    noHighConfidence: board.bestStock === null && board.bestCrypto === null,
    bestStock: board.bestStock ? toOpportunityCandidate(board.bestStock) : null,
    bestCrypto: board.bestCrypto
      ? toOpportunityCandidate(board.bestCrypto)
      : null,
    whyNoBestStock: board.whyNoBestStock,
    whyNoBestCrypto: board.whyNoBestCrypto,
    actionableTrades,
    candidates,
    topStocks: board.topStocks.map(toOpportunityCandidate),
    topCrypto: board.topCrypto.map(toOpportunityCandidate),
    topEtfs: board.topEtfs.map(toOpportunityCandidate),
    discovered: board.discovered.map(toOpportunityCandidate),
    speculative: board.speculative.map(toOpportunityCandidate),
    developing: board.developing.map(toOpportunityCandidate),
    blocked: board.blocked.map(toOpportunityCandidate),
    watch: board.watch.map(toOpportunityCandidate),
    noTrade: sorted
      .filter((i) => i.boardQuality === "NO_TRADE" || i.quality === "NO_TRADE")
      .map(toOpportunityCandidate),
    dataSkipped: sorted
      .filter((i) => i.quality === "DATA_INSUFFICIENT")
      .map(toOpportunityCandidate),
    summary: {
      assetsInCatalog: catalogSize(),
      assetsEvaluated: sorted.length,
      stocksAnalyzed,
      cryptoAnalyzed,
      etfAnalyzed,
      actionableTrades: actionableTrades.length,
      developing: board.developing.length,
      speculative: board.speculative.length,
      watch: board.watch.length,
      blocked: board.blocked.length,
      discovered: board.discovered.length,
      dataSkipped: dataSkippedCount,
      highNewsImpact,
      marketRegime:
        sorted[0]?.marketRegime ?? input.pipelineMeta.marketRegime ?? "UNKNOWN",
      freshness: freshnessCounts,
      lastMarketUpdate,
      lastNewsUpdate,
      lastAiUpdate,
      validSetups: sorted.filter(
        (i) =>
          (i.quality === "STRONG" || i.quality === "CONFIRMED") &&
          i.tradeStatus === "ELIGIBLE",
      ).length,
      openPaperHint: "See Paper Positions for open simulated trades.",
    },
    newsSummary: {
      highImpactCount: highNewsImpact,
      evaluatedWithNews: sorted.filter((i) => i.newsItems.length > 0).length,
    },
    freshnessSummary: freshnessCounts,
    whyNoSetup: input.pipelineMeta.signalReport?.whyNoSetup ?? [],
    blockerAggregate: input.pipelineMeta.signalReport?.blockerAggregate ?? null,
    confirmationSimulation:
      input.pipelineMeta.signalReport?.confirmationSimulation ?? null,
    freshness: input.pipelineMeta.signalReport
      ? {
          liveCount: input.pipelineMeta.signalReport.liveAssets ?? 0,
          dataSkippedCount: input.pipelineMeta.signalReport.dataSkipped ?? 0,
          skipReasons: input.pipelineMeta.signalReport.skipReasons ?? {},
        }
      : null,
    sectorExposureWarnings,
  };
}
