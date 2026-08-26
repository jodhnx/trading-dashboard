import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import type { Timeframe } from "@/types/enums";
import type { MarketDataService } from "@/services/market/market-data-service";
import type { MtfFrameStatus, MtfAlignment } from "./types";
import { emaBearish, emaBullish } from "@/engine/trading/score";

export const MTF_REGIME_TIMEFRAME: Timeframe = "1day";
export const MTF_SETUP_TIMEFRAME: Timeframe = "4h";
export const MTF_ENTRY_TIMEFRAME: Timeframe = "1h";
/** Cap MTF enrichment to protect provider rate limits during universe scans. */
export const MTF_ENRICH_LIMIT = 6;

function emaLabel(snapshot: TechnicalSnapshot): string {
  if (emaBullish(snapshot)) return "BULLISH";
  if (emaBearish(snapshot)) return "BEARISH";
  return "NONE";
}

function macdLabel(snapshot: TechnicalSnapshot): string {
  if (snapshot.macdHistogram === null) return "MISSING";
  if (snapshot.macdHistogram > 0) return "POSITIVE";
  if (snapshot.macdHistogram < 0) return "NEGATIVE";
  return "FLAT";
}

export function snapshotToMtfFrame(
  snapshot: TechnicalSnapshot | null,
  fallbackTimeframe: string,
  reason: string | null,
): MtfFrameStatus {
  if (!snapshot) {
    return {
      timeframe: fallbackTimeframe,
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
      reason: reason ?? "DATA_UNAVAILABLE",
    };
  }

  if (snapshot.dataStatus === "UNAVAILABLE" || snapshot.dataStatus === "MOCK") {
    return {
      timeframe: snapshot.timeframe || fallbackTimeframe,
      available: false,
      dataStatus: snapshot.dataStatus,
      trend: snapshot.trend,
      momentum: snapshot.momentum,
      ema20: snapshot.ema20,
      ema50: snapshot.ema50,
      ema200: snapshot.ema200,
      macd: snapshot.macd,
      macdSignal: snapshot.macdSignal,
      macdHistogram: snapshot.macdHistogram,
      atr14: snapshot.atr14,
      timestamp: snapshot.asOf ? snapshot.asOf.toISOString() : null,
      reason: reason ?? "DATA_UNAVAILABLE",
    };
  }

  return {
    timeframe: snapshot.timeframe || fallbackTimeframe,
    available: true,
    dataStatus: snapshot.dataStatus,
    trend: snapshot.trend,
    momentum: snapshot.momentum,
    ema20: snapshot.ema20,
    ema50: snapshot.ema50,
    ema200: snapshot.ema200,
    macd: snapshot.macd,
    macdSignal: snapshot.macdSignal,
    macdHistogram: snapshot.macdHistogram,
    atr14: snapshot.atr14,
    timestamp: snapshot.asOf ? snapshot.asOf.toISOString() : null,
    reason: null,
  };
}

export function emptyMtfAlignment(daily: TechnicalSnapshot): MtfAlignment {
  return {
    daily: snapshotToMtfFrame(daily, MTF_REGIME_TIMEFRAME, null),
    setup: snapshotToMtfFrame(null, MTF_SETUP_TIMEFRAME, "not_enriched"),
    entry: snapshotToMtfFrame(null, MTF_ENTRY_TIMEFRAME, "not_enriched"),
    aligned: false,
    score: 50,
    notes: [
      "Higher-timeframe daily regime only — setup/entry frames not enriched yet (not fabricated)",
    ],
  };
}

function trendsAgree(a: string, b: string): boolean {
  if (a === "BULLISH" && b === "BULLISH") return true;
  if (a === "BEARISH" && b === "BEARISH") return true;
  return false;
}

/**
 * Evaluate multi-timeframe alignment from available frames only.
 * Missing frames are never invented as bullish/bearish.
 */
export function evaluateMultiTimeframeAlignment(input: {
  daily: TechnicalSnapshot;
  setup: TechnicalSnapshot | null;
  entry: TechnicalSnapshot | null;
}): MtfAlignment {
  const daily = snapshotToMtfFrame(input.daily, MTF_REGIME_TIMEFRAME, null);
  const setupTf = snapshotToMtfFrame(
    input.setup,
    MTF_SETUP_TIMEFRAME,
    input.setup ? null : "DATA_UNAVAILABLE",
  );
  const entryTf = snapshotToMtfFrame(
    input.entry,
    MTF_ENTRY_TIMEFRAME,
    input.entry ? null : "DATA_UNAVAILABLE",
  );

  let score = 50;
  let aligned = false;
  const notes: string[] = [];

  // Annotate available frames with EMA/MACD labels in notes (values are on the frame).
  if (daily.available) {
    notes.push(
      `Daily EMA ${emaLabel(input.daily)} · MACD ${macdLabel(input.daily)}`,
    );
  }

  if (setupTf.available && input.setup) {
    notes.push(
      `4H EMA ${emaLabel(input.setup)} · MACD ${macdLabel(input.setup)}`,
    );
    if (trendsAgree(daily.trend, setupTf.trend)) {
      score += 25;
      aligned = true;
      notes.push("Daily and setup timeframe trends agree");
    } else if (setupTf.trend === "NEUTRAL" || setupTf.trend === "UNKNOWN") {
      score -= 5;
      notes.push("Setup timeframe trend not directional");
    } else {
      score -= 20;
      notes.push("Daily and setup timeframe trends disagree");
    }
  } else {
    notes.push(
      `Setup timeframe (${MTF_SETUP_TIMEFRAME}) unavailable — not fabricated`,
    );
  }

  if (entryTf.available && input.entry) {
    notes.push(
      `1H EMA ${emaLabel(input.entry)} · MACD ${macdLabel(input.entry)}`,
    );
    const referenceTrend = setupTf.available ? setupTf.trend : daily.trend;
    if (trendsAgree(referenceTrend, entryTf.trend)) {
      score += 15;
      aligned = true;
      notes.push("Entry timeframe confirms setup/regime trend");
    } else if (entryTf.trend === "NEUTRAL" || entryTf.trend === "UNKNOWN") {
      notes.push("Entry timeframe neutral");
    } else {
      score -= 10;
      notes.push("Entry timeframe conflicts with higher timeframe");
    }
  } else {
    notes.push(
      `Entry timeframe (${MTF_ENTRY_TIMEFRAME}) unavailable — not fabricated`,
    );
  }

  // All three directional and agreeing → high alignment
  if (
    daily.available &&
    setupTf.available &&
    entryTf.available &&
    trendsAgree(daily.trend, setupTf.trend) &&
    trendsAgree(setupTf.trend, entryTf.trend) &&
    (daily.trend === "BULLISH" || daily.trend === "BEARISH")
  ) {
    aligned = true;
    score = Math.max(score, 90);
    notes.push("1D / 4H / 1H trends fully aligned");
  }

  const clamped = Math.min(100, Math.max(0, score));
  return {
    daily,
    setup: setupTf,
    entry: entryTf,
    aligned,
    score: clamped,
    notes,
  };
}

/** Score 0–100 used in opportunity weighting (multiTimeFrame: 10). */
export function calculateMultiTimeframeScore(input: {
  daily: TechnicalSnapshot;
  setup: TechnicalSnapshot | null;
  entry: TechnicalSnapshot | null;
}): { score: number; alignment: MtfAlignment } {
  const alignment = evaluateMultiTimeframeAlignment(input);
  return { score: alignment.score, alignment };
}

/** @deprecated use calculateMultiTimeframeScore */
export function scoreMtfAlignment(input: {
  daily: TechnicalSnapshot;
  setup: TechnicalSnapshot | null;
  entry: TechnicalSnapshot | null;
}): { score: number; alignment: MtfAlignment } {
  return calculateMultiTimeframeScore(input);
}

/**
 * Fetch optional MTF snapshots. Never fabricates. Honors rate-limit flag.
 */
export async function loadOptionalMtfSnapshots(input: {
  market: MarketDataService;
  symbol: string;
  rateLimited: boolean;
}): Promise<{
  setup: TechnicalSnapshot | null;
  entry: TechnicalSnapshot | null;
  rateLimited: boolean;
}> {
  if (input.rateLimited) {
    return { setup: null, entry: null, rateLimited: true };
  }

  let rateLimited = false;
  let setup: TechnicalSnapshot | null = null;
  let entry: TechnicalSnapshot | null = null;

  try {
    const result = await input.market.getTechnicalSnapshot(
      input.symbol,
      MTF_SETUP_TIMEFRAME,
    );
    if (
      result.snapshot.dataStatus !== "UNAVAILABLE" &&
      result.snapshot.dataStatus !== "MOCK"
    ) {
      setup = result.snapshot;
    }
  } catch (error) {
    const reason =
      error &&
      typeof error === "object" &&
      "details" in error &&
      (error as { details?: { reason?: string } }).details?.reason;
    if (reason === "rate_limit") rateLimited = true;
  }

  if (rateLimited) {
    return { setup, entry: null, rateLimited: true };
  }

  try {
    const result = await input.market.getTechnicalSnapshot(
      input.symbol,
      MTF_ENTRY_TIMEFRAME,
    );
    if (
      result.snapshot.dataStatus !== "UNAVAILABLE" &&
      result.snapshot.dataStatus !== "MOCK"
    ) {
      entry = result.snapshot;
    }
  } catch (error) {
    const reason =
      error &&
      typeof error === "object" &&
      "details" in error &&
      (error as { details?: { reason?: string } }).details?.reason;
    if (reason === "rate_limit") rateLimited = true;
  }

  return { setup, entry, rateLimited };
}
