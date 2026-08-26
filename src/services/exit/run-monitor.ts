import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { normalizeInternalSymbol } from "@/services/market/symbols";
import { monitorOpenPositions, type PositionExitAlert } from "./monitor";
import { toExitCandidate, type ExitCandidate } from "./present";

export type ExitMonitorResult = {
  ok: true;
  evaluatedAt: string;
  count: number;
  exits: ExitCandidate[];
  urgent: ExitCandidate[];
  takeProfit: ExitCandidate[];
  skippedStaleOrUnavailable: number;
  schedulerNote: string;
  /** True when quotes were LIVE/CACHED; false means do not treat as intraday. */
  dataFreshEnoughForIntraday: boolean;
};

const SCHEDULER_NOTE =
  "Exit monitor is callable by daily cron or an external/hourly scheduler. Hobby one-cron/day is not real-time — UI must show LAST CHECKED vs LIVE.";

/**
 * Service boundary for position exit evaluation.
 * Callable by cron, external scheduler, or API — does not depend on UI.
 * Never fabricates prices; skips positions without LIVE/CACHED quotes.
 */
export async function runExitMonitor(input: {
  userId: string;
  persistence?: "session" | "admin";
  now?: Date;
}): Promise<ExitMonitorResult> {
  const now = input.now ?? new Date();
  const evaluatedAt = now.toISOString();
  const supabase =
    input.persistence === "admin"
      ? createAdminSupabaseClient()
      : await createServerSupabaseClient();

  const { data: positions } = await supabase
    .from("paper_positions")
    .select(
      "id, side, average_entry, stop_loss, take_profit_1, take_profit_2, asset_id",
    )
    .eq("user_id", input.userId)
    .eq("status", "OPEN");

  if (!positions || positions.length === 0) {
    return {
      ok: true,
      evaluatedAt,
      count: 0,
      exits: [],
      urgent: [],
      takeProfit: [],
      skippedStaleOrUnavailable: 0,
      schedulerNote: SCHEDULER_NOTE,
      dataFreshEnoughForIntraday: false,
    };
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

  const alerts: PositionExitAlert[] = await monitorOpenPositions({
    positions: positions.map((row) => ({
      id: row.id,
      symbol: symbolById.get(row.asset_id) ?? "UNKNOWN",
      side: row.side,
      averageEntry: Number(row.average_entry),
      stopLoss: row.stop_loss !== null ? Number(row.stop_loss) : null,
      takeProfit: row.take_profit_1 !== null ? Number(row.take_profit_1) : null,
      takeProfit2: row.take_profit_2 !== null ? Number(row.take_profit_2) : null,
    })),
    now,
  });

  const exits = alerts.map(toExitCandidate);
  const skippedStaleOrUnavailable = Math.max(
    0,
    positions.length - alerts.length,
  );

  return {
    ok: true,
    evaluatedAt,
    count: exits.length,
    exits,
    urgent: exits.filter((e) => e.exitUrgency === "URGENT_EXIT"),
    takeProfit: exits.filter((e) => e.exitUrgency === "TAKE_PROFIT"),
    skippedStaleOrUnavailable,
    schedulerNote: SCHEDULER_NOTE,
    dataFreshEnoughForIntraday:
      exits.length > 0 && skippedStaleOrUnavailable === 0,
  };
}
