import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeInternalSymbol } from "@/services/market/symbols";
import type { PortfolioHoldingRow, PortfolioRow } from "@/types/database";
import type { StoredHolding } from "./types";

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

export async function getOrCreatePortfolio(input: {
  userId: string;
  currency?: string;
}): Promise<PortfolioRow> {
  const supabase = await createServerSupabaseClient();
  const existing = await supabase
    .from("portfolios")
    .select("*")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (existing.data) {
    return existing.data;
  }

  const inserted = await supabase
    .from("portfolios")
    .insert({
      user_id: input.userId,
      cash: 0,
      currency: input.currency ?? "EUR",
    })
    .select("*")
    .single();

  if (inserted.error || !inserted.data) {
    // Race: another request created it
    const again = await supabase
      .from("portfolios")
      .select("*")
      .eq("user_id", input.userId)
      .single();
    if (again.error || !again.data) {
      throw new Error("PORTFOLIO_UNAVAILABLE");
    }
    return again.data;
  }
  return inserted.data;
}

export async function updatePortfolioCash(input: {
  userId: string;
  cash: number;
}): Promise<PortfolioRow | null> {
  const portfolio = await getOrCreatePortfolio({ userId: input.userId });
  const supabase = await createServerSupabaseClient();
  const updated = await supabase
    .from("portfolios")
    .update({ cash: input.cash })
    .eq("id", portfolio.id)
    .eq("user_id", input.userId)
    .select("*")
    .single();
  return updated.data ?? null;
}

function mapHolding(
  row: PortfolioHoldingRow,
  symbol: string,
): StoredHolding {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    userId: row.user_id,
    assetId: row.asset_id,
    symbol,
    quantity: Number(row.quantity),
    averageEntryPrice: Number(row.average_entry_price),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listHoldings(input: {
  userId: string;
  portfolioId: string;
}): Promise<StoredHolding[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("portfolio_holdings")
    .select("*, assets!inner(symbol)")
    .eq("user_id", input.userId)
    .eq("portfolio_id", input.portfolioId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    // Fallback without join if relationship name differs
    const plain = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("user_id", input.userId)
      .eq("portfolio_id", input.portfolioId)
      .order("created_at", { ascending: true });
    if (plain.error || !plain.data) {
      return [];
    }
    const holdings: StoredHolding[] = [];
    for (const row of plain.data) {
      const asset = await supabase
        .from("assets")
        .select("symbol")
        .eq("id", row.asset_id)
        .maybeSingle();
      if (!asset.data) continue;
      holdings.push(mapHolding(row, asset.data.symbol));
    }
    return holdings;
  }

  return data.map((row) => {
    const assets = (row as { assets?: { symbol?: string } }).assets;
    const symbol =
      typeof assets?.symbol === "string" ? assets.symbol : "UNKNOWN";
    return mapHolding(row, symbol);
  });
}

export async function findHoldingById(input: {
  userId: string;
  holdingId: string;
}): Promise<StoredHolding | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("portfolio_holdings")
    .select("*")
    .eq("id", input.holdingId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!data) {
    return null;
  }
  const asset = await supabase
    .from("assets")
    .select("symbol")
    .eq("id", data.asset_id)
    .maybeSingle();
  if (!asset.data) {
    return null;
  }
  return mapHolding(data, asset.data.symbol);
}

export async function insertHolding(input: {
  userId: string;
  portfolioId: string;
  assetId: string;
  quantity: number;
  averageEntryPrice: number;
}): Promise<{ ok: true; row: PortfolioHoldingRow } | { ok: false; code: "DUPLICATE_HOLDING" | "DATA_UNAVAILABLE" }> {
  const supabase = await createServerSupabaseClient();
  const inserted = await supabase
    .from("portfolio_holdings")
    .insert({
      portfolio_id: input.portfolioId,
      user_id: input.userId,
      asset_id: input.assetId,
      quantity: input.quantity,
      average_entry_price: input.averageEntryPrice,
    })
    .select("*")
    .single();

  if (inserted.error) {
    if (inserted.error.code === "23505") {
      return { ok: false, code: "DUPLICATE_HOLDING" };
    }
    return { ok: false, code: "DATA_UNAVAILABLE" };
  }
  if (!inserted.data) {
    return { ok: false, code: "DATA_UNAVAILABLE" };
  }
  return { ok: true, row: inserted.data };
}

export async function updateHolding(input: {
  userId: string;
  holdingId: string;
  quantity?: number;
  averageEntryPrice?: number;
}): Promise<PortfolioHoldingRow | null> {
  const patch: {
    quantity?: number;
    average_entry_price?: number;
  } = {};
  if (input.quantity !== undefined) {
    patch.quantity = input.quantity;
  }
  if (input.averageEntryPrice !== undefined) {
    patch.average_entry_price = input.averageEntryPrice;
  }
  const supabase = await createServerSupabaseClient();
  const updated = await supabase
    .from("portfolio_holdings")
    .update(patch)
    .eq("id", input.holdingId)
    .eq("user_id", input.userId)
    .select("*")
    .single();
  return updated.data ?? null;
}

export async function deleteHolding(input: {
  userId: string;
  holdingId: string;
}): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const deleted = await supabase
    .from("portfolio_holdings")
    .delete()
    .eq("id", input.holdingId)
    .eq("user_id", input.userId)
    .select("id");
  return Boolean(deleted.data && deleted.data.length > 0);
}
