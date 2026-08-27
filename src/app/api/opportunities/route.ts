import { getAuthUser } from "@/lib/auth/session";
import { listStoredOpportunities } from "@/services/opportunity/persistence";
import { loadPipelineOpportunityBoardMeta } from "@/services/opportunity/board-meta";
import { boardFromStored } from "@/services/opportunity/board-from-stored";
import { toOpportunityCandidate } from "@/services/opportunity/present";
import { utcBriefDate } from "@/services/daily-brief/date";
import { catalogSize } from "@/services/universe/catalog";
import {
  SCHEDULER_NOTE,
  type ScanBoardState,
} from "@/services/opportunity/types";

function deriveBoardStateFromRows(input: {
  confirmed: number;
  developing: number;
  blocked: number;
  watch: number;
}): ScanBoardState | null {
  if (input.confirmed > 0) return "OPPORTUNITIES_AVAILABLE";
  if (input.developing + input.blocked + input.watch > 0) return "WATCH_ONLY";
  return null;
}

function boardMessage(state: ScanBoardState): string {
  switch (state) {
    case "DATA_INSUFFICIENT":
      return "No usable LIVE/CACHED market scan for this UTC day yet, or the scanner lacked technical data. This is not the same as NO_TRADE.";
    case "NO_TRADE":
      return "Market data was analyzed; no setup cleared the evidence bar today.";
    case "WATCH_ONLY":
      return "Interesting or developing candidates exist, but none cleared CONFIRMED/STRONG.";
    case "OPPORTUNITIES_AVAILABLE":
      return "Ranked opportunities available from the latest daily scan.";
  }
}

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? utcBriefDate();
  const opportunities = await listStoredOpportunities({
    userId: user.id,
    briefDate: date,
    limit: 40,
  });

  const board = boardFromStored(opportunities);
  const confirmedCount = opportunities.filter(
    (item) =>
      (item.quality === "STRONG" || item.quality === "CONFIRMED") &&
      item.tradeStatus === "ELIGIBLE",
  ).length;

  const fromRows = deriveBoardStateFromRows({
    confirmed: confirmedCount,
    developing: board.developing.length,
    blocked: board.blocked.length,
    watch: board.watch.length,
  });

  const pipelineMeta = await loadPipelineOpportunityBoardMeta(date);

  const boardState: ScanBoardState =
    fromRows ??
    pipelineMeta.boardState ??
    (pipelineMeta.scanned && (pipelineMeta.liveOrCached ?? 0) === 0
      ? "DATA_INSUFFICIENT"
      : pipelineMeta.scanned
        ? "NO_TRADE"
        : "DATA_INSUFFICIENT");

  const validSetups = opportunities.filter(
    (item) =>
      (item.quality === "STRONG" || item.quality === "CONFIRMED") &&
      item.tradeStatus === "ELIGIBLE",
  ).length;

  return Response.json({
    ok: true,
    date,
    boardState,
    marketRegime:
      opportunities[0]?.marketRegime ??
      pipelineMeta.marketRegime ??
      "UNKNOWN",
    noHighConfidence: board.bestStock === null && board.bestCrypto === null,
    bestStock: board.bestStock ? toOpportunityCandidate(board.bestStock) : null,
    bestCrypto: board.bestCrypto
      ? toOpportunityCandidate(board.bestCrypto)
      : null,
    whyNoBestStock: board.whyNoBestStock,
    whyNoBestCrypto: board.whyNoBestCrypto,
    topStocks: board.topStocks.map(toOpportunityCandidate),
    topCrypto: board.topCrypto.map(toOpportunityCandidate),
    topEtfs: board.topEtfs.map(toOpportunityCandidate),
    discovered: board.discovered.map(toOpportunityCandidate),
    speculative: board.speculative.map(toOpportunityCandidate),
    developing: board.developing.map(toOpportunityCandidate),
    blocked: board.blocked.map(toOpportunityCandidate),
    watch: board.watch.map(toOpportunityCandidate),
    summary: {
      validSetups,
      developing: board.developing.length,
      watch: board.watch.length,
      blocked: board.blocked.length,
      discovered: board.discovered.length,
      speculative: board.speculative.length,
      universeSize: catalogSize(),
      openPaperHint: "See Paper Positions for open simulated trades.",
    },
    exitAlerts: [],
    exitMonitoringNote:
      "Live exit evaluation runs on /api/opportunities/exits — this board uses stored scan data only.",
    whyNoSetup: pipelineMeta.signalReport?.whyNoSetup ?? [],
    blockerAggregate: pipelineMeta.signalReport?.blockerAggregate ?? null,
    confirmationSimulation:
      pipelineMeta.signalReport?.confirmationSimulation ?? null,
    freshness: pipelineMeta.signalReport
      ? {
          liveCount: pipelineMeta.signalReport.liveAssets ?? 0,
          dataSkippedCount: pipelineMeta.signalReport.dataSkipped ?? 0,
          skipReasons: pipelineMeta.signalReport.skipReasons ?? {},
        }
      : null,
    schedulerNote: SCHEDULER_NOTE,
    message: boardMessage(boardState),
    disclaimer:
      "PAPER / informational only — not broker orders. Only CONFIRMED/STRONG + ELIGIBLE with valid levels is actionable. BLOCKED / EARLY_SETUP / WATCH are never BUY.",
  });
}
