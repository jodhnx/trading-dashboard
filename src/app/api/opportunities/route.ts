import { getAuthUser } from "@/lib/auth/session";
import { listStoredOpportunities } from "@/services/opportunity/persistence";
import { loadPipelineOpportunityBoardMeta } from "@/services/opportunity/board-meta";
import { utcBriefDate } from "@/services/daily-brief/date";
import { monitorOpenPositions } from "@/services/exit/monitor";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeInternalSymbol } from "@/services/market/symbols";
import type { ScanBoardState } from "@/services/opportunity/types";

function deriveBoardStateFromRows(input: {
  topStocks: number;
  topCrypto: number;
  watch: number;
}): ScanBoardState | null {
  if (input.topStocks + input.topCrypto > 0) return "OPPORTUNITIES_AVAILABLE";
  if (input.watch > 0) return "WATCH_ONLY";
  return null;
}

function boardMessage(state: ScanBoardState): string {
  switch (state) {
    case "DATA_INSUFFICIENT":
      return "No usable LIVE/CACHED market scan for this UTC day yet, or the scanner lacked technical data. This is not the same as NO_TRADE.";
    case "NO_TRADE":
      return "Market data was analyzed; no setup cleared the evidence bar today.";
    case "WATCH_ONLY":
      return "Interesting candidates exist, but none cleared a full VALID LONG/SHORT opportunity bar.";
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

  const topStocks = opportunities.filter(
    (item) =>
      item.assetClass !== "CRYPTO" &&
      (item.tier === "STRONG_OPPORTUNITY" || item.tier === "OPPORTUNITY"),
  );
  const topCrypto = opportunities.filter(
    (item) =>
      item.assetClass === "CRYPTO" &&
      (item.tier === "STRONG_OPPORTUNITY" || item.tier === "OPPORTUNITY"),
  );
  const watch = opportunities.filter((item) => item.tier === "WATCH");

  const fromRows = deriveBoardStateFromRows({
    topStocks: topStocks.length,
    topCrypto: topCrypto.length,
    watch: watch.length,
  });

  const pipelineMeta = fromRows
    ? null
    : await loadPipelineOpportunityBoardMeta(date);

  const boardState: ScanBoardState =
    fromRows ??
    pipelineMeta?.boardState ??
    (pipelineMeta?.scanned && (pipelineMeta.liveOrCached ?? 0) === 0
      ? "DATA_INSUFFICIENT"
      : pipelineMeta?.scanned
        ? "NO_TRADE"
        : "DATA_INSUFFICIENT");

  let exitAlerts: Awaited<ReturnType<typeof monitorOpenPositions>> = [];
  try {
    const supabase = await createServerSupabaseClient();
    const { data: positions } = await supabase
      .from("paper_positions")
      .select(
        "id, side, average_entry, stop_loss, take_profit_1, take_profit_2, asset_id",
      )
      .eq("user_id", user.id)
      .eq("status", "OPEN");

    if (positions && positions.length > 0) {
      const assetIds = [...new Set(positions.map((row) => row.asset_id))];
      const { data: assets } = await supabase
        .from("assets")
        .select("id, symbol")
        .in("id", assetIds);
      const symbolById = new Map(
        (assets ?? []).map((asset) => [
          asset.id,
          normalizeInternalSymbol(asset.symbol),
        ]),
      );

      exitAlerts = await monitorOpenPositions({
        positions: positions.map((row) => ({
          id: row.id,
          symbol: symbolById.get(row.asset_id) ?? "UNKNOWN",
          side: row.side,
          averageEntry: Number(row.average_entry),
          stopLoss: row.stop_loss !== null ? Number(row.stop_loss) : null,
          takeProfit:
            row.take_profit_1 !== null ? Number(row.take_profit_1) : null,
          takeProfit2:
            row.take_profit_2 !== null ? Number(row.take_profit_2) : null,
        })),
      });
    }
  } catch {
    exitAlerts = [];
  }

  return Response.json({
    ok: true,
    date,
    boardState,
    marketRegime:
      opportunities[0]?.marketRegime ??
      pipelineMeta?.marketRegime ??
      "UNKNOWN",
    noHighConfidence: topStocks.length === 0 && topCrypto.length === 0,
    topStocks,
    topCrypto,
    watch,
    exitAlerts,
    message: boardMessage(boardState),
    disclaimer:
      "Opportunities are informational only. They do not guarantee profit and are not executed orders.",
  });
}
