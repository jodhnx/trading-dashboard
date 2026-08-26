import { getAuthUser } from "@/lib/auth/session";
import { listStoredOpportunities } from "@/services/opportunity/persistence";
import { loadPipelineOpportunityBoardMeta } from "@/services/opportunity/board-meta";
import { boardFromStored } from "@/services/opportunity/board-from-stored";
import { toOpportunityCandidate } from "@/services/opportunity/present";
import { utcBriefDate } from "@/services/daily-brief/date";
import { SCHEDULER_NOTE } from "@/services/opportunity/types";

/**
 * Best current stock/crypto opportunities from the latest stored daily scan.
 * Never invents prices or forces a trade when evidence is insufficient.
 */
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
  const pipelineMeta = await loadPipelineOpportunityBoardMeta(date);

  return Response.json({
    ok: true,
    date,
    marketRegime:
      opportunities[0]?.marketRegime ??
      pipelineMeta.marketRegime ??
      "UNKNOWN",
    bestStock: board.bestStock ? toOpportunityCandidate(board.bestStock) : null,
    bestCrypto: board.bestCrypto
      ? toOpportunityCandidate(board.bestCrypto)
      : null,
    topStocks: board.topStocks.map(toOpportunityCandidate),
    topCrypto: board.topCrypto.map(toOpportunityCandidate),
    developing: board.developing.map(toOpportunityCandidate),
    blocked: board.blocked.map(toOpportunityCandidate),
    watch: board.watch.map(toOpportunityCandidate),
    whyNoBestStock: board.whyNoBestStock,
    whyNoBestCrypto: board.whyNoBestCrypto,
    message:
      board.bestStock === null && board.bestCrypto === null
        ? "No high-confidence opportunity currently."
        : "Best current opportunities from evidence-backed ranking.",
    schedulerNote: SCHEDULER_NOTE,
    disclaimer:
      "Informational only. No profit guarantee. EARLY_SETUP is not a buy/sell instruction.",
  });
}
