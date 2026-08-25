import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeInternalSymbol } from "@/services/market/symbols";
import type { PaperSetupSnapshot } from "@/services/paper/types";
import type { JournalEntryRow } from "@/types/database";
import type { JournalEntryRecord, JournalListFilters } from "./types";
import type { PositionSide } from "@/types/enums";

function parseSetupSnapshot(value: unknown): PaperSetupSnapshot | null {
  if (!value || typeof value !== "object") return null;
  return value as PaperSetupSnapshot;
}

export function mapJournalRow(row: JournalEntryRow): JournalEntryRecord {
  return {
    id: row.id,
    userId: row.user_id,
    paperTradeId: row.paper_trade_id,
    assetId: row.asset_id,
    symbol: row.symbol,
    side: row.side,
    entryPrice: row.entry_price === null ? null : Number(row.entry_price),
    exitPrice: row.exit_price === null ? null : Number(row.exit_price),
    quantity: row.quantity === null ? null : Number(row.quantity),
    realizedPnL: row.realized_pnl === null ? null : Number(row.realized_pnl),
    realizedPnLPercent:
      row.realized_pnl_percent === null
        ? null
        : Number(row.realized_pnl_percent),
    entryTime: row.entry_time,
    exitTime: row.exit_time,
    setupRating:
      row.setup_rating === null
        ? row.setup_quality === null
          ? null
          : Number(row.setup_quality)
        : Number(row.setup_rating),
    executionRating:
      row.execution_rating === null ? null : Number(row.execution_rating),
    disciplineRating:
      row.discipline_rating === null
        ? row.discipline_score === null
          ? null
          : Number(row.discipline_score)
        : Number(row.discipline_rating),
    emotionalState: row.emotional_state,
    mistakeType: row.mistake_type,
    lesson: row.lesson ?? row.lessons,
    whatWentWell: row.what_went_well,
    whatWentWrong: row.what_went_wrong ?? row.mistakes,
    notes: row.notes,
    tags: row.tags ?? [],
    setupSnapshot: parseSetupSnapshot(row.setup_snapshot),
    setupScore: row.setup_score === null ? null : Number(row.setup_score),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findAssetBySymbol(symbol: string): Promise<{
  id: string;
  symbol: string;
} | null> {
  const supabase = await createServerSupabaseClient();
  const internal = normalizeInternalSymbol(symbol);
  const { data } = await supabase
    .from("assets")
    .select("id, symbol")
    .eq("symbol", internal)
    .maybeSingle();
  return data ?? null;
}

export async function listJournalEntries(input: {
  userId: string;
  filters?: JournalListFilters;
}): Promise<JournalEntryRecord[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("journal_entries")
    .select("*")
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false });

  if (input.filters?.symbol) {
    query = query.eq("symbol", normalizeInternalSymbol(input.filters.symbol));
  }
  if (input.filters?.side) {
    query = query.eq("side", input.filters.side);
  }
  if (input.filters?.from) {
    query = query.gte("created_at", `${input.filters.from}T00:00:00.000Z`);
  }
  if (input.filters?.to) {
    query = query.lte("created_at", `${input.filters.to}T23:59:59.999Z`);
  }
  if (input.filters?.tag) {
    query = query.contains("tags", [input.filters.tag]);
  }
  query = query.limit(input.filters?.limit ?? 100);

  const { data } = await query;
  return (data ?? []).map(mapJournalRow);
}

export async function findJournalEntryById(input: {
  userId: string;
  entryId: string;
}): Promise<JournalEntryRecord | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("id", input.entryId)
    .eq("user_id", input.userId)
    .maybeSingle();
  return data ? mapJournalRow(data) : null;
}

export async function findJournalByPaperTradeId(input: {
  userId: string;
  paperTradeId: string;
}): Promise<JournalEntryRecord | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("user_id", input.userId)
    .eq("paper_trade_id", input.paperTradeId)
    .maybeSingle();
  return data ? mapJournalRow(data) : null;
}

export async function insertJournalEntry(input: {
  userId: string;
  row: Partial<JournalEntryRow> & Pick<JournalEntryRow, "user_id">;
}): Promise<JournalEntryRecord | null> {
  const supabase = await createServerSupabaseClient();
  const inserted = await supabase
    .from("journal_entries")
    .insert(input.row)
    .select("*")
    .single();
  return inserted.data ? mapJournalRow(inserted.data) : null;
}

export async function updateJournalEntry(input: {
  userId: string;
  entryId: string;
  patch: Partial<JournalEntryRow>;
}): Promise<JournalEntryRecord | null> {
  const supabase = await createServerSupabaseClient();
  const updated = await supabase
    .from("journal_entries")
    .update(input.patch)
    .eq("id", input.entryId)
    .eq("user_id", input.userId)
    .select("*")
    .single();
  return updated.data ? mapJournalRow(updated.data) : null;
}

export async function deleteJournalEntry(input: {
  userId: string;
  entryId: string;
}): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const deleted = await supabase
    .from("journal_entries")
    .delete()
    .eq("id", input.entryId)
    .eq("user_id", input.userId)
    .select("id");
  return Boolean(deleted.data && deleted.data.length > 0);
}

export async function findClosedPaperTrade(input: {
  userId: string;
  paperTradeId: string;
}): Promise<{
  id: string;
  asset_id: string;
  side: PositionSide;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  pnl: number | null;
  pnl_percent: number | null;
  setup_score: number | null;
  setup_snapshot: unknown;
  opened_at: string;
  closed_at: string | null;
  symbol: string;
} | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("paper_trades")
    .select("*")
    .eq("id", input.paperTradeId)
    .eq("user_id", input.userId)
    .eq("status", "CLOSED")
    .maybeSingle();
  if (!data) return null;
  const asset = await supabase
    .from("assets")
    .select("symbol")
    .eq("id", data.asset_id)
    .maybeSingle();
  const symbol = asset.data?.symbol ?? "UNKNOWN";
  return {
    id: data.id,
    asset_id: data.asset_id,
    side: data.side,
    entry_price: Number(data.entry_price),
    exit_price: data.exit_price === null ? null : Number(data.exit_price),
    quantity: Number(data.quantity),
    pnl: data.pnl === null ? null : Number(data.pnl),
    pnl_percent: data.pnl_percent === null ? null : Number(data.pnl_percent),
    setup_score: data.setup_score === null ? null : Number(data.setup_score),
    setup_snapshot: data.setup_snapshot,
    opened_at: data.opened_at,
    closed_at: data.closed_at,
    symbol,
  };
}

export async function listJournalPaperTradeIds(input: {
  userId: string;
}): Promise<Map<string, string>> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("journal_entries")
    .select("id, paper_trade_id")
    .eq("user_id", input.userId)
    .not("paper_trade_id", "is", null);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.paper_trade_id) {
      map.set(row.paper_trade_id, row.id);
    }
  }
  return map;
}
