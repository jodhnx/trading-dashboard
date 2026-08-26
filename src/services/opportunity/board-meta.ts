import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { ScanBoardState } from "./types";
import { SCAN_BOARD_STATES } from "./types";

function asBoardState(value: unknown): ScanBoardState | null {
  return typeof value === "string" &&
    (SCAN_BOARD_STATES as readonly string[]).includes(value)
    ? (value as ScanBoardState)
    : null;
}

/**
 * Read the latest pipeline scan board state for a UTC brief date.
 * Used when the opportunities table is empty so DATA_INSUFFICIENT and
 * genuine NO_TRADE are not confused.
 */
export async function loadPipelineOpportunityBoardMeta(briefDate: string): Promise<{
  boardState: ScanBoardState | null;
  marketRegime: string | null;
  liveOrCached: number | null;
  scanned: boolean;
}> {
  try {
    const admin = createAdminSupabaseClient();
    const { data } = await admin
      .from("pipeline_runs")
      .select("result_summary, status")
      .eq("brief_date", briefDate)
      .in("status", ["SUCCESS", "PARTIAL", "FAILED"])
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data?.result_summary || typeof data.result_summary !== "object") {
      return {
        boardState: null,
        marketRegime: null,
        liveOrCached: null,
        scanned: false,
      };
    }

    const summary = data.result_summary as Record<string, unknown>;
    const opportunities = summary.opportunities as
      | Record<string, unknown>
      | undefined;
    if (!opportunities) {
      return {
        boardState: null,
        marketRegime: null,
        liveOrCached: null,
        scanned: false,
      };
    }

    return {
      boardState: asBoardState(opportunities.boardState),
      marketRegime:
        typeof opportunities.marketRegime === "string"
          ? opportunities.marketRegime
          : null,
      liveOrCached:
        typeof opportunities.liveOrCached === "number"
          ? opportunities.liveOrCached
          : null,
      scanned: true,
    };
  } catch {
    return {
      boardState: null,
      marketRegime: null,
      liveOrCached: null,
      scanned: false,
    };
  }
}
