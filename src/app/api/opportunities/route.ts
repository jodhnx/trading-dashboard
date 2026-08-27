import { getAuthUser } from "@/lib/auth/session";
import { listStoredOpportunities } from "@/services/opportunity/persistence";
import { loadPipelineOpportunityBoardMeta } from "@/services/opportunity/board-meta";
import { buildOpportunitiesBoardResponse } from "@/services/opportunity/board-response";
import { utcBriefDate } from "@/services/daily-brief/date";
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
    limit: 500,
  });

  const confirmedCount = opportunities.filter(
    (item) =>
      (item.quality === "STRONG" || item.quality === "CONFIRMED") &&
      item.tradeStatus === "ELIGIBLE",
  ).length;

  const developing = opportunities.filter((i) => i.boardQuality === "DEVELOPING").length;
  const blocked = opportunities.filter((i) => i.tradeStatus === "BLOCKED").length;
  const watch = opportunities.filter((i) => i.boardQuality === "WATCH").length;

  const pipelineMeta = await loadPipelineOpportunityBoardMeta(date);
  const fromRows = deriveBoardStateFromRows({
    confirmed: confirmedCount,
    developing,
    blocked,
    watch,
  });

  const boardState: ScanBoardState =
    fromRows ??
    pipelineMeta.boardState ??
    (pipelineMeta.scanned && (pipelineMeta.liveOrCached ?? 0) === 0
      ? "DATA_INSUFFICIENT"
      : pipelineMeta.scanned
        ? "NO_TRADE"
        : "DATA_INSUFFICIENT");

  const payload = buildOpportunitiesBoardResponse({
    date,
    opportunities,
    boardState,
    pipelineMeta,
  });

  return Response.json({
    ok: true,
    ...payload,
    exitAlerts: [],
    exitMonitoringNote:
      "Live exit evaluation runs on /api/opportunities/exits — this board uses stored scan data only.",
    schedulerNote: SCHEDULER_NOTE,
    message: boardMessage(boardState),
    disclaimer:
      "PAPER / informational only — not broker orders. Only CONFIRMED/STRONG + ELIGIBLE with valid levels is actionable. BLOCKED / EARLY_SETUP / WATCH are never BUY.",
  });
}
