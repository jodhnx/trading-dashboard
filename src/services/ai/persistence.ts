import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { normalizeInternalSymbol } from "@/services/market/symbols";
import { analysisFromRow, toInsertRow, type AnalysisInsert } from "./map-row";
import type { TradingAnalysisRecord } from "@/ai/types";
import { fingerprintFromSnapshot } from "@/services/pipeline/fingerprint";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

async function resolveSupabase(
  mode: "session" | "admin",
): Promise<SupabaseClient<Database>> {
  return mode === "admin"
    ? createAdminSupabaseClient()
    : await createServerSupabaseClient();
}

export async function findAssetIdBySymbol(
  symbol: string,
  mode: "session" | "admin" = "session",
): Promise<string | null> {
  const supabase = await resolveSupabase(mode);
  const internal = normalizeInternalSymbol(symbol);
  const { data } = await supabase
    .from("assets")
    .select("id")
    .eq("symbol", internal)
    .maybeSingle();
  return data?.id ?? null;
}

export async function persistAnalysis(
  input: AnalysisInsert & {
    inputFingerprint?: string;
    persistence?: "session" | "admin";
  },
): Promise<TradingAnalysisRecord | null> {
  const supabase = await resolveSupabase(input.persistence ?? "session");
  const row = toInsertRow(input, input.inputFingerprint);
  const inserted = await supabase
    .from("ai_analyses")
    .insert(row)
    .select("*")
    .single();
  if (inserted.error || !inserted.data) {
    return null;
  }
  return analysisFromRow(inserted.data, input.record.symbol);
}

export async function listOwnAnalyses(input: {
  userId: string;
  symbol: string;
  limit: number;
}): Promise<TradingAnalysisRecord[]> {
  const supabase = await createServerSupabaseClient();
  const assetId = await findAssetIdBySymbol(input.symbol);
  if (!assetId) {
    return [];
  }
  const { data, error } = await supabase
    .from("ai_analyses")
    .select("*")
    .eq("user_id", input.userId)
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false })
    .limit(input.limit);
  if (error || !data) {
    return [];
  }
  return data
    .map((row) => analysisFromRow(row, normalizeInternalSymbol(input.symbol)))
    .filter((item): item is TradingAnalysisRecord => item !== null);
}

export async function findAnalysisByFingerprint(input: {
  userId: string;
  symbol: string;
  fingerprint: string;
  persistence?: "session" | "admin";
  limit?: number;
}): Promise<TradingAnalysisRecord | null> {
  const supabase = await resolveSupabase(input.persistence ?? "admin");
  const assetId = await findAssetIdBySymbol(input.symbol, input.persistence ?? "admin");
  if (!assetId) {
    return null;
  }
  const { data, error } = await supabase
    .from("ai_analyses")
    .select("*")
    .eq("user_id", input.userId)
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 10);
  if (error || !data) {
    return null;
  }
  const internal = normalizeInternalSymbol(input.symbol);
  for (const row of data) {
    if (fingerprintFromSnapshot(row.input_snapshot) === input.fingerprint) {
      return analysisFromRow(row, internal);
    }
  }
  return null;
}
