import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapJournalRow } from "@/services/journal/persistence";
import { normalizeInternalSymbol } from "@/services/market/symbols";
import type { BacktestRunRow, PaperAccountRow, PaperPositionRow, PaperTradeRow } from "@/types/database";
import type { StoredPaperTrade } from "@/services/paper/types";
import type { JournalEntryRecord } from "@/services/journal/types";
import { ANALYTICS_MAX_TRADES } from "./constants";
import type { ResolvedDateRange } from "./types";
import { closedAtBounds } from "./date";
import type { StoredOpenPosition } from "./paper-performance";

function mapTrade(row: PaperTradeRow, symbol: string): StoredPaperTrade {
  return {
    id: row.id,
    userId: row.user_id,
    positionId: row.position_id,
    assetId: row.asset_id,
    symbol,
    side: row.side,
    entryPrice: Number(row.entry_price),
    exitPrice: row.exit_price === null ? null : Number(row.exit_price),
    quantity: Number(row.quantity),
    riskAmount: row.risk_amount === null ? null : Number(row.risk_amount),
    pnl: row.pnl === null ? null : Number(row.pnl),
    pnlPercent: row.pnl_percent === null ? null : Number(row.pnl_percent),
    stopLoss: row.stop_loss === null ? null : Number(row.stop_loss),
    takeProfit: row.take_profit === null ? null : Number(row.take_profit),
    setupScore: row.setup_score === null ? null : Number(row.setup_score),
    setupSnapshot: null,
    status: row.status,
    closeReason: row.close_reason,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
  };
}

async function symbolMapForAssets(
  assetIds: string[],
): Promise<Map<string, string>> {
  if (assetIds.length === 0) {
    return new Map();
  }
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("assets")
    .select("id, symbol")
    .in("id", assetIds);
  return new Map((data ?? []).map((row) => [row.id, row.symbol]));
}

export async function loadPaperAccount(input: {
  userId: string;
}): Promise<PaperAccountRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("paper_accounts")
    .select("*")
    .eq("user_id", input.userId)
    .maybeSingle();
  return data ?? null;
}

export async function loadClosedPaperTrades(input: {
  userId: string;
  range: ResolvedDateRange;
  symbol?: string;
}): Promise<StoredPaperTrade[]> {
  const supabase = await createServerSupabaseClient();
  const bounds = closedAtBounds(input.range);
  let query = supabase
    .from("paper_trades")
    .select("*")
    .eq("user_id", input.userId)
    .eq("status", "CLOSED")
    .order("closed_at", { ascending: true })
    .limit(ANALYTICS_MAX_TRADES);

  if (bounds.from) {
    query = query.gte("closed_at", bounds.from);
  }
  if (bounds.to) {
    query = query.lte("closed_at", bounds.to);
  }

  const { data } = await query;
  if (!data || data.length === 0) {
    return [];
  }

  const assetIds = [...new Set(data.map((row) => row.asset_id))];
  const symbols = await symbolMapForAssets(assetIds);
  const trades = data
    .map((row) => {
      const symbol = symbols.get(row.asset_id);
      if (!symbol) {
        return null;
      }
      return mapTrade(row, symbol);
    })
    .filter((trade): trade is StoredPaperTrade => trade !== null);

  if (!input.symbol || input.symbol === "ALL") {
    return trades;
  }
  const filterSymbol = normalizeInternalSymbol(input.symbol);
  return trades.filter((trade) => trade.symbol === filterSymbol);
}

export async function loadOpenPaperPositions(input: {
  userId: string;
  symbol?: string;
}): Promise<StoredOpenPosition[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("paper_positions")
    .select("*")
    .eq("user_id", input.userId)
    .eq("status", "OPEN")
    .order("opened_at", { ascending: true });

  if (!data || data.length === 0) {
    return [];
  }

  const assetIds = [...new Set(data.map((row) => row.asset_id))];
  const symbols = await symbolMapForAssets(assetIds);
  const positions = data
    .map((row: PaperPositionRow) => {
      const symbol = symbols.get(row.asset_id);
      if (!symbol) {
        return null;
      }
      return {
        symbol,
        side: row.side,
        quantity: Number(row.quantity),
        entryPrice: Number(row.average_entry),
        currentPrice:
          row.current_price === null ? null : Number(row.current_price),
      };
    })
    .filter((position): position is StoredOpenPosition => position !== null);

  if (!input.symbol || input.symbol === "ALL") {
    return positions;
  }
  const filterSymbol = normalizeInternalSymbol(input.symbol);
  return positions.filter((position) => position.symbol === filterSymbol);
}

export async function loadJournalEntries(input: {
  userId: string;
  range: ResolvedDateRange;
  symbol?: string;
}): Promise<JournalEntryRecord[]> {
  const supabase = await createServerSupabaseClient();
  const bounds = closedAtBounds(input.range);
  let query = supabase
    .from("journal_entries")
    .select("*")
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(ANALYTICS_MAX_TRADES);

  if (bounds.from) {
    query = query.gte("created_at", bounds.from);
  }
  if (bounds.to) {
    query = query.lte("created_at", bounds.to);
  }
  if (input.symbol && input.symbol !== "ALL") {
    query = query.eq("symbol", normalizeInternalSymbol(input.symbol));
  }

  const { data } = await query;
  return (data ?? []).map(mapJournalRow);
}

export async function loadBacktestRuns(input: {
  userId: string;
}): Promise<Array<{ row: BacktestRunRow; symbol: string | null }>> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("backtest_runs")
    .select("*")
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!data || data.length === 0) {
    return [];
  }

  const assetIds = [
    ...new Set(
      data
        .map((row) => row.asset_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const symbols = await symbolMapForAssets(assetIds);
  return data.map((row) => ({
    row,
    symbol: row.asset_id ? symbols.get(row.asset_id) ?? null : null,
  }));
}
