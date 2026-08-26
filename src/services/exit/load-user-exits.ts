import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeInternalSymbol } from "@/services/market/symbols";
import { monitorOpenPositions } from "@/services/exit/monitor";
import { toExitCandidate } from "@/services/exit/present";

export async function loadUserExitCandidates(userId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: positions } = await supabase
      .from("paper_positions")
      .select(
        "id, side, average_entry, stop_loss, take_profit_1, take_profit_2, asset_id",
      )
      .eq("user_id", userId)
      .eq("status", "OPEN");

    if (!positions || positions.length === 0) {
      return [];
    }

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

    const alerts = await monitorOpenPositions({
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

    return alerts.map(toExitCandidate);
  } catch {
    return [];
  }
}
