import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { EnvValidationError } from "@/lib/env/errors";
import { normalizeInternalSymbol } from "./symbols";
import type { Candle, Quote } from "./provider";
import type { Timeframe } from "@/types/enums";

function toFinite(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function getAdmin() {
  try {
    return createAdminSupabaseClient();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return null;
    }
    throw error;
  }
}

async function findAssetId(
  client: NonNullable<Awaited<ReturnType<typeof getAdmin>>>,
  symbol: string,
): Promise<string | null> {
  const internal = normalizeInternalSymbol(symbol);
  const { data } = await client
    .from("assets")
    .select("id")
    .eq("symbol", internal)
    .maybeSingle();
  return data?.id ?? null;
}

export async function persistQuote(internalSymbol: string, quote: Quote): Promise<void> {
  if (quote.isMock) {
    return;
  }
  const client = await getAdmin();
  if (!client) {
    return;
  }
  const assetId = await findAssetId(client, internalSymbol);
  if (!assetId) {
    return;
  }

  await client.from("market_data").upsert(
    {
      asset_id: assetId,
      timestamp: quote.dataTimestamp.toISOString(),
      open: quote.open,
      high: quote.high,
      low: quote.low,
      close: quote.price,
      volume: quote.volume,
      change: quote.change,
      change_percent: quote.changePercent,
      source: String(quote.source),
      timeframe: "1min",
    },
    { onConflict: "asset_id,timestamp,timeframe,source" },
  );
}

export async function persistCandles(
  internalSymbol: string,
  timeframe: Timeframe,
  candles: Candle[],
): Promise<void> {
  const live = candles.filter((candle) => !candle.isMock);
  if (live.length === 0) {
    return;
  }
  const client = await getAdmin();
  if (!client) {
    return;
  }
  const assetId = await findAssetId(client, internalSymbol);
  if (!assetId) {
    return;
  }

  await client.from("market_candles").upsert(
    live.map((candle) => ({
      asset_id: assetId,
      timestamp: candle.timestamp.toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      source: String(candle.source),
      timeframe,
    })),
    { onConflict: "asset_id,timestamp,timeframe,source" },
  );
}

export async function loadLatestQuote(internalSymbol: string): Promise<Quote | null> {
  const client = await getAdmin();
  if (!client) {
    return null;
  }
  const assetId = await findAssetId(client, internalSymbol);
  if (!assetId) {
    return null;
  }

  const { data } = await client
    .from("market_data")
    .select("*")
    .eq("asset_id", assetId)
    .order("timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const price = toFinite(data.close);
  const timestamp = new Date(data.timestamp);
  if (price === null || Number.isNaN(timestamp.getTime())) {
    return null;
  }

  return {
    symbol: normalizeInternalSymbol(internalSymbol),
    name: null,
    exchange: null,
    currency: null,
    price,
    change: toFinite(data.change),
    changePercent: toFinite(data.change_percent),
    open: toFinite(data.open),
    high: toFinite(data.high),
    low: toFinite(data.low),
    previousClose: null,
    volume: toFinite(data.volume),
    timestamp,
    dataTimestamp: timestamp,
    isMarketOpen: null,
    source: "supabase",
    isMock: false,
  };
}

export async function loadCandles(
  internalSymbol: string,
  timeframe: Timeframe,
  limit: number,
): Promise<Candle[] | null> {
  const client = await getAdmin();
  if (!client) {
    return null;
  }
  const assetId = await findAssetId(client, internalSymbol);
  if (!assetId) {
    return null;
  }

  const { data } = await client
    .from("market_candles")
    .select("*")
    .eq("asset_id", assetId)
    .eq("timeframe", timeframe)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (!data || data.length === 0) {
    return null;
  }

  const candles: Candle[] = [];
  for (const row of [...data].reverse()) {
    const open = toFinite(row.open);
    const high = toFinite(row.high);
    const low = toFinite(row.low);
    const close = toFinite(row.close);
    const timestamp = new Date(row.timestamp);
    if (
      open === null ||
      high === null ||
      low === null ||
      close === null ||
      Number.isNaN(timestamp.getTime())
    ) {
      continue;
    }
    candles.push({
      symbol: normalizeInternalSymbol(internalSymbol),
      timestamp,
      open,
      high,
      low,
      close,
      volume: toFinite(row.volume),
      timeframe,
      source: "supabase",
      isMock: false,
    });
  }

  return candles.length > 0 ? candles : null;
}
