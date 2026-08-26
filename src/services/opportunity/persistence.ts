import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeInternalSymbol } from "@/services/market/symbols";
import type { Database, Json, OpportunityRow } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RankedOpportunity } from "./types";

async function resolveClient(
  mode: "session" | "admin",
): Promise<SupabaseClient<Database>> {
  return mode === "admin"
    ? createAdminSupabaseClient()
    : await createServerSupabaseClient();
}

async function findAssetId(
  supabase: SupabaseClient<Database>,
  symbol: string,
): Promise<string | null> {
  const internal = normalizeInternalSymbol(symbol);
  const { data } = await supabase
    .from("assets")
    .select("id")
    .eq("symbol", internal)
    .maybeSingle();
  return data?.id ?? null;
}

async function symbolForAssetId(
  supabase: SupabaseClient<Database>,
  assetId: string,
): Promise<{ symbol: string; name: string }> {
  const { data } = await supabase
    .from("assets")
    .select("symbol, name")
    .eq("id", assetId)
    .maybeSingle();
  return {
    symbol: data?.symbol ?? "UNKNOWN",
    name: data?.name ?? data?.symbol ?? "UNKNOWN",
  };
}

function decisionFor(opportunity: RankedOpportunity): string {
  if (opportunity.tier === "NO_TRADE") return "NO_TRADE";
  if (opportunity.tier === "WATCH") return "WATCH";
  if (opportunity.direction === "SHORT") return "SHORT_SETUP";
  if (opportunity.direction === "LONG") return "BUY_SETUP";
  return "NO_TRADE";
}

function legacyScore10(score100: number): number {
  return Math.min(10, Math.max(0, Number((score100 / 10).toFixed(1))));
}

export async function persistOpportunityScan(input: {
  userId: string;
  briefDate: string;
  opportunities: RankedOpportunity[];
  dailyBriefId?: string | null;
  persistence?: "session" | "admin";
}): Promise<{ inserted: number; skipped: number }> {
  const supabase = await resolveClient(input.persistence ?? "admin");
  let inserted = 0;
  let skipped = 0;

  await supabase
    .from("opportunities")
    .update({ status: "EXPIRED" })
    .eq("user_id", input.userId)
    .in("status", ["NEW", "VALID"])
    .gte("created_at", `${input.briefDate}T00:00:00.000Z`)
    .lte("created_at", `${input.briefDate}T23:59:59.999Z`);

  for (const opportunity of input.opportunities) {
    if (
      opportunity.tier !== "STRONG_OPPORTUNITY" &&
      opportunity.tier !== "OPPORTUNITY" &&
      opportunity.tier !== "WATCH"
    ) {
      skipped += 1;
      continue;
    }
    const assetId = await findAssetId(supabase, opportunity.symbol);
    if (!assetId) {
      skipped += 1;
      continue;
    }

    const row = {
      user_id: input.userId,
      daily_brief_id: input.dailyBriefId ?? null,
      asset_id: assetId,
      decision: decisionFor(opportunity),
      score: legacyScore10(opportunity.scores.opportunityScore),
      confidence: legacyScore10(opportunity.scores.opportunityScore),
      entry: opportunity.entry,
      stop_loss: opportunity.stopLoss,
      take_profit_1: opportunity.takeProfit1,
      take_profit_2: opportunity.takeProfit2,
      risk_reward: opportunity.riskReward,
      position_size: opportunity.positionSize,
      risk_amount: opportunity.riskAmount,
      reasons: opportunity.reasons,
      risks: opportunity.risks,
      invalidation:
        opportunity.invalidation !== null
          ? String(opportunity.invalidation)
          : null,
      status: opportunity.tier === "WATCH" ? "NEW" : "VALID",
      opportunity_score: opportunity.scores.opportunityScore,
      score_breakdown: {
        ...opportunity.scores,
        currentPrice: opportunity.currentPrice,
        atr14: opportunity.atr14,
        engineScore: opportunity.engineScore,
        waitingFor: opportunity.waitingFor,
        newsItems: opportunity.newsItems,
        confirmation: opportunity.confirmation,
        quality: opportunity.quality,
        technicalConfirmation: opportunity.technicalConfirmation,
        tradeStatus: opportunity.tradeStatus,
        blockReason: opportunity.blockReason,
        dataFreshness: opportunity.dataFreshness,
        confidence: opportunity.confidence,
        thesis: opportunity.thesis,
        mtf: opportunity.mtf,
      } as unknown as Json,
      asset_class: opportunity.assetClass,
      setup_type: opportunity.setupType,
      holding_horizon: opportunity.holdingHorizon,
      opportunity_tier: opportunity.tier,
      market_regime: opportunity.marketRegime,
      entry_zone_low: opportunity.entryZoneLow,
      entry_zone_high: opportunity.entryZoneHigh,
      max_chase: opportunity.maxChase,
      scan_date: input.briefDate,
      data_status: opportunity.dataStatus,
      news_headlines: opportunity.newsHeadlines,
    };

    const insertedRow = await supabase.from("opportunities").insert(row as never);
    if (insertedRow.error) {
      skipped += 1;
    } else {
      inserted += 1;
    }
  }

  return { inserted, skipped };
}

function mapOpportunityRow(
  row: OpportunityRow,
  asset: { symbol: string; name: string },
): RankedOpportunity {
  const breakdown = (row.score_breakdown ?? {}) as RankedOpportunity["scores"] & {
    currentPrice?: number | null;
    atr14?: number | null;
    engineScore?: number | null;
    waitingFor?: string[];
    newsItems?: RankedOpportunity["newsItems"];
    confirmation?: RankedOpportunity["confirmation"];
    quality?: RankedOpportunity["quality"];
    technicalConfirmation?: string;
    tradeStatus?: RankedOpportunity["tradeStatus"];
    blockReason?: string | null;
    dataFreshness?: RankedOpportunity["dataFreshness"];
    confidence?: number;
    thesis?: string;
    mtf?: RankedOpportunity["mtf"];
  };

  const tier = (row.opportunity_tier as RankedOpportunity["tier"]) ?? "WATCH";
  const quality: RankedOpportunity["quality"] =
    breakdown.quality ??
    (tier === "STRONG_OPPORTUNITY"
      ? "STRONG"
      : tier === "OPPORTUNITY"
        ? "CONFIRMED"
        : tier === "WATCH"
          ? "WATCH"
          : "NO_TRADE");

  const dataStatus =
    (row.data_status as RankedOpportunity["dataStatus"]) ?? "UNAVAILABLE";
  const dataFreshness =
    breakdown.dataFreshness ??
    (dataStatus === "LIVE"
      ? "LIVE"
      : dataStatus === "CACHED"
        ? "CACHED"
        : dataStatus === "STALE"
          ? "STALE"
          : "UNAVAILABLE");

  const multiTimeFrameScore =
    breakdown.multiTimeFrameScore ?? breakdown.multiTimeframeScore ?? 50;

  const tradeStatus: RankedOpportunity["tradeStatus"] =
    breakdown.tradeStatus ??
    (quality === "STRONG" || quality === "CONFIRMED" ? "ELIGIBLE" : "NO_TRADE");

  return {
    symbol: asset.symbol,
    name: asset.name,
    assetClass: (row.asset_class as RankedOpportunity["assetClass"]) ?? "STOCK",
    direction:
      row.decision === "SHORT_SETUP"
        ? "SHORT"
        : row.decision === "BUY_SETUP"
          ? "LONG"
          : "NO_TRADE",
    tier,
    quality,
    technicalConfirmation:
      breakdown.technicalConfirmation ??
      (quality === "STRONG" || quality === "CONFIRMED"
        ? "STRONG"
        : quality === "EARLY_SETUP"
          ? "EARLY_SETUP"
          : "WATCH"),
    tradeStatus,
    blockReason: breakdown.blockReason ?? null,
    setupType: (row.setup_type as RankedOpportunity["setupType"]) ?? "NO_SETUP",
    holdingHorizon:
      (row.holding_horizon as RankedOpportunity["holdingHorizon"]) ?? "UNKNOWN",
    currentPrice: breakdown.currentPrice ?? null,
    atr14: breakdown.atr14 ?? null,
    engineScore: breakdown.engineScore ?? null,
    entry: row.entry,
    entryZoneLow: row.entry_zone_low,
    entryZoneHigh: row.entry_zone_high,
    maxChase: row.max_chase,
    stopLoss: row.stop_loss,
    takeProfit1: row.take_profit_1,
    takeProfit2: row.take_profit_2,
    invalidation: row.invalidation ? Number(row.invalidation) : null,
    riskReward: row.risk_reward,
    positionSize: row.position_size,
    riskAmount: row.risk_amount,
    scores: {
      technicalScore: breakdown.technicalScore ?? 0,
      momentumScore: breakdown.momentumScore ?? 0,
      volumeScore: breakdown.volumeScore ?? 0,
      newsScore: breakdown.newsScore ?? 0,
      catalystScore: breakdown.catalystScore ?? 0,
      sentimentScore: breakdown.sentimentScore ?? 0,
      marketRegimeScore: breakdown.marketRegimeScore ?? 0,
      riskRewardScore: breakdown.riskRewardScore ?? 0,
      multiTimeFrameScore,
      multiTimeframeScore: multiTimeFrameScore,
      opportunityScore: row.opportunity_score ?? Number(row.score) * 10,
      weights: breakdown.weights ?? {
        technical: 20,
        momentum: 15,
        volume: 10,
        news: 15,
        catalyst: 10,
        sentiment: 5,
        marketRegime: 5,
        riskReward: 10,
        multiTimeFrame: 10,
      },
    },
    marketRegime: (row.market_regime as RankedOpportunity["marketRegime"]) ?? "UNKNOWN",
    dataStatus,
    dataFreshness,
    confidence:
      breakdown.confidence ??
      Math.round(row.opportunity_score ?? Number(row.score) * 10),
    thesis: breakdown.thesis ?? (row.reasons?.[0] ?? "Stored opportunity"),
    mtf: breakdown.mtf ?? {
      daily: {
        timeframe: "1day",
        available: dataStatus !== "UNAVAILABLE",
        dataStatus,
        trend: "UNKNOWN",
        momentum: "UNKNOWN",
        ema20: null,
        ema50: null,
        ema200: null,
        macd: null,
        macdSignal: null,
        macdHistogram: null,
        atr14: null,
        timestamp: null,
        reason: null,
      },
      setup: {
        timeframe: "4h",
        available: false,
        dataStatus: "UNAVAILABLE",
        trend: "UNKNOWN",
        momentum: "UNKNOWN",
        ema20: null,
        ema50: null,
        ema200: null,
        macd: null,
        macdSignal: null,
        macdHistogram: null,
        atr14: null,
        timestamp: null,
        reason: "DATA_UNAVAILABLE",
      },
      entry: {
        timeframe: "1h",
        available: false,
        dataStatus: "UNAVAILABLE",
        trend: "UNKNOWN",
        momentum: "UNKNOWN",
        ema20: null,
        ema50: null,
        ema200: null,
        macd: null,
        macdSignal: null,
        macdHistogram: null,
        atr14: null,
        timestamp: null,
        reason: "DATA_UNAVAILABLE",
      },
      aligned: false,
      score: multiTimeFrameScore,
      notes: ["MTF details not in stored row"],
    },
    reasons: row.reasons ?? [],
    risks: row.risks ?? [],
    waitingFor: breakdown.waitingFor ?? [],
    newsHeadlines: row.news_headlines ?? [],
    newsItems: breakdown.newsItems ?? [],
    confirmation: breakdown.confirmation ?? null,
    scannedAt: row.created_at,
  };
}

export async function listStoredOpportunities(input: {
  userId: string;
  briefDate?: string;
  limit?: number;
  persistence?: "session" | "admin";
}): Promise<RankedOpportunity[]> {
  const supabase = await resolveClient(input.persistence ?? "session");
  let query = supabase
    .from("opportunities")
    .select("*")
    .eq("user_id", input.userId)
    .in("status", ["NEW", "VALID"])
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 40);

  if (input.briefDate) {
    query = query.eq("scan_date", input.briefDate);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }

  const mapped: RankedOpportunity[] = [];
  for (const row of data) {
    const asset = await symbolForAssetId(supabase, row.asset_id);
    mapped.push(mapOpportunityRow(row, asset));
  }
  return mapped;
}
