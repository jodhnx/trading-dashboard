import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeInternalSymbol } from "@/services/market/symbols";
import { USER_SETTINGS_DEFAULTS } from "@/types/settings";
import type {
  PaperAccountRow,
  PaperPositionRow,
  PaperTradeRow,
} from "@/types/database";
import type {
  PaperSetupSnapshot,
  StoredPaperPosition,
  StoredPaperTrade,
} from "./types";
import type { PositionSide } from "@/types/enums";
import type { PaperCloseReason } from "@/types/database";

const DEFAULT_STARTING_BALANCE = USER_SETTINGS_DEFAULTS.capital;

export async function findAssetBySymbol(symbol: string): Promise<{
  id: string;
  symbol: string;
  name: string;
} | null> {
  const supabase = await createServerSupabaseClient();
  const internal = normalizeInternalSymbol(symbol);
  const { data } = await supabase
    .from("assets")
    .select("id, symbol, name")
    .eq("symbol", internal)
    .maybeSingle();
  return data ?? null;
}

export async function getOrCreatePaperAccount(input: {
  userId: string;
}): Promise<PaperAccountRow> {
  const supabase = await createServerSupabaseClient();
  const existing = await supabase
    .from("paper_accounts")
    .select("*")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (existing.data) {
    return existing.data;
  }

  const inserted = await supabase
    .from("paper_accounts")
    .insert({
      user_id: input.userId,
      starting_balance: DEFAULT_STARTING_BALANCE,
      cash_balance: DEFAULT_STARTING_BALANCE,
    })
    .select("*")
    .single();

  if (inserted.error || !inserted.data) {
    const again = await supabase
      .from("paper_accounts")
      .select("*")
      .eq("user_id", input.userId)
      .single();
    if (again.error || !again.data) {
      throw new Error("PAPER_ACCOUNT_UNAVAILABLE");
    }
    return again.data;
  }
  return inserted.data;
}

export async function updatePaperAccountCash(input: {
  userId: string;
  accountId: string;
  cashBalance: number;
}): Promise<PaperAccountRow | null> {
  const supabase = await createServerSupabaseClient();
  const updated = await supabase
    .from("paper_accounts")
    .update({ cash_balance: input.cashBalance })
    .eq("id", input.accountId)
    .eq("user_id", input.userId)
    .select("*")
    .single();
  return updated.data ?? null;
}

function mapPosition(
  row: PaperPositionRow,
  symbol: string,
): StoredPaperPosition {
  return {
    id: row.id,
    accountId: row.account_id,
    userId: row.user_id,
    assetId: row.asset_id,
    symbol,
    side: row.side,
    quantity: Number(row.quantity),
    entryPrice: Number(row.average_entry),
    stopLoss: row.stop_loss === null ? null : Number(row.stop_loss),
    takeProfit: row.take_profit_1 === null ? null : Number(row.take_profit_1),
    openedAt: row.opened_at,
    updatedAt: row.updated_at,
  };
}

function parseSetupSnapshot(value: unknown): PaperSetupSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as PaperSetupSnapshot;
}

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
    setupSnapshot: parseSetupSnapshot(row.setup_snapshot),
    status: row.status,
    closeReason: row.close_reason,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
  };
}

async function symbolForAsset(assetId: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("assets")
    .select("symbol")
    .eq("id", assetId)
    .maybeSingle();
  return data?.symbol ?? null;
}

export async function listOpenPositions(input: {
  userId: string;
}): Promise<StoredPaperPosition[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("paper_positions")
    .select("*")
    .eq("user_id", input.userId)
    .eq("status", "OPEN")
    .order("opened_at", { ascending: true });
  if (!data) {
    return [];
  }
  const positions: StoredPaperPosition[] = [];
  for (const row of data) {
    const symbol = await symbolForAsset(row.asset_id);
    if (!symbol) continue;
    positions.push(mapPosition(row, symbol));
  }
  return positions;
}

export async function findOpenPositionById(input: {
  userId: string;
  positionId: string;
}): Promise<StoredPaperPosition | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("paper_positions")
    .select("*")
    .eq("id", input.positionId)
    .eq("user_id", input.userId)
    .eq("status", "OPEN")
    .maybeSingle();
  if (!data) {
    return null;
  }
  const symbol = await symbolForAsset(data.asset_id);
  if (!symbol) {
    return null;
  }
  return mapPosition(data, symbol);
}

export async function findDuplicateOpenPosition(input: {
  userId: string;
  assetId: string;
  side: PositionSide;
}): Promise<StoredPaperPosition | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("paper_positions")
    .select("*")
    .eq("user_id", input.userId)
    .eq("asset_id", input.assetId)
    .eq("side", input.side)
    .eq("status", "OPEN")
    .maybeSingle();
  if (!data) {
    return null;
  }
  const symbol = await symbolForAsset(data.asset_id);
  if (!symbol) {
    return null;
  }
  return mapPosition(data, symbol);
}

export async function insertOpenPosition(input: {
  userId: string;
  accountId: string;
  assetId: string;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
}): Promise<PaperPositionRow | null> {
  const supabase = await createServerSupabaseClient();
  const inserted = await supabase
    .from("paper_positions")
    .insert({
      user_id: input.userId,
      account_id: input.accountId,
      asset_id: input.assetId,
      side: input.side,
      quantity: input.quantity,
      average_entry: input.entryPrice,
      stop_loss: input.stopLoss,
      take_profit_1: input.takeProfit,
      status: "OPEN",
    })
    .select("*")
    .single();
  return inserted.data ?? null;
}

export async function insertOpenTrade(input: {
  userId: string;
  positionId: string;
  assetId: string;
  side: PositionSide;
  entryPrice: number;
  quantity: number;
  riskAmount: number;
  stopLoss: number;
  takeProfit: number;
  setupScore: number | null;
  positionValue: number;
  setupSnapshot: PaperSetupSnapshot;
}): Promise<PaperTradeRow | null> {
  const supabase = await createServerSupabaseClient();
  const inserted = await supabase
    .from("paper_trades")
    .insert({
      user_id: input.userId,
      position_id: input.positionId,
      asset_id: input.assetId,
      side: input.side,
      entry_price: input.entryPrice,
      quantity: input.quantity,
      risk_amount: input.riskAmount,
      stop_loss: input.stopLoss,
      take_profit: input.takeProfit,
      setup_score: input.setupScore,
      position_value: input.positionValue,
      setup_snapshot: input.setupSnapshot,
      status: "OPEN",
    })
    .select("*")
    .single();
  return inserted.data ?? null;
}

export async function closePositionRow(input: {
  userId: string;
  positionId: string;
  currentPrice: number;
}): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const updated = await supabase
    .from("paper_positions")
    .update({
      status: "CLOSED",
      current_price: input.currentPrice,
    })
    .eq("id", input.positionId)
    .eq("user_id", input.userId)
    .eq("status", "OPEN")
    .select("id");
  return Boolean(updated.data && updated.data.length > 0);
}

export async function closeTradeRow(input: {
  userId: string;
  positionId: string;
  exitPrice: number;
  pnl: number;
  pnlPercent: number | null;
  closeReason: PaperCloseReason;
  closedAt: string;
}): Promise<PaperTradeRow | null> {
  const supabase = await createServerSupabaseClient();
  const updated = await supabase
    .from("paper_trades")
    .update({
      exit_price: input.exitPrice,
      pnl: input.pnl,
      pnl_percent: input.pnlPercent,
      exit_reason: input.closeReason,
      close_reason: input.closeReason,
      status: "CLOSED",
      closed_at: input.closedAt,
    })
    .eq("position_id", input.positionId)
    .eq("user_id", input.userId)
    .eq("status", "OPEN")
    .select("*")
    .single();
  return updated.data ?? null;
}

export async function listClosedTrades(input: {
  userId: string;
  limit?: number;
}): Promise<StoredPaperTrade[]> {
  const supabase = await createServerSupabaseClient();
  const query = supabase
    .from("paper_trades")
    .select("*")
    .eq("user_id", input.userId)
    .eq("status", "CLOSED")
    .order("closed_at", { ascending: false });
  if (input.limit) {
    query.limit(input.limit);
  }
  const { data } = await query;
  if (!data) {
    return [];
  }
  const trades: StoredPaperTrade[] = [];
  for (const row of data) {
    const symbol = await symbolForAsset(row.asset_id);
    if (!symbol) continue;
    trades.push(mapTrade(row, symbol));
  }
  return trades;
}

export async function sumRealizedPnL(input: {
  userId: string;
}): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("paper_trades")
    .select("pnl")
    .eq("user_id", input.userId)
    .eq("status", "CLOSED");
  if (!data) {
    return 0;
  }
  return data.reduce((sum, row) => sum + (row.pnl === null ? 0 : Number(row.pnl)), 0);
}

export async function findOpenTradeByPositionId(input: {
  userId: string;
  positionId: string;
}): Promise<StoredPaperTrade | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("paper_trades")
    .select("*")
    .eq("user_id", input.userId)
    .eq("position_id", input.positionId)
    .eq("status", "OPEN")
    .maybeSingle();
  if (!data) {
    return null;
  }
  const symbol = await symbolForAsset(data.asset_id);
  if (!symbol) {
    return null;
  }
  return mapTrade(data, symbol);
}
