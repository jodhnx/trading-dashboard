import { getAuthUser } from "@/lib/auth/session";
import { listStoredOpportunities } from "@/services/opportunity/persistence";
import { utcBriefDate } from "@/services/daily-brief/date";
import { monitorOpenPositions } from "@/services/exit/monitor";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeInternalSymbol } from "@/services/market/symbols";

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
        (assets ?? []).map((asset) => [asset.id, normalizeInternalSymbol(asset.symbol)]),
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
    marketRegime: opportunities[0]?.marketRegime ?? "UNKNOWN",
    noHighConfidence: topStocks.length === 0 && topCrypto.length === 0,
    topStocks,
    topCrypto,
    watch,
    exitAlerts,
    disclaimer:
      "Opportunities are informational only. They do not guarantee profit and are not executed orders.",
  });
}
