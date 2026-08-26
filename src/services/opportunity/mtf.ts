import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import type { Timeframe } from "@/types/enums";
import type { MarketDataService } from "@/services/market/market-data-service";
import type { MtfFrameStatus, MtfAlignment } from "./types";

export const MTF_REGIME_TIMEFRAME: Timeframe = "1day";
export const MTF_SETUP_TIMEFRAME: Timeframe = "4h";
export const MTF_ENTRY_TIMEFRAME: Timeframe = "1h";
/** Cap MTF enrichment to protect provider rate limits during universe scans. */
export const MTF_ENRICH_LIMIT = 6;

export function emptyMtfAlignment(daily: TechnicalSnapshot): MtfAlignment {
  return {
    daily: {
      timeframe: daily.timeframe || MTF_REGIME_TIMEFRAME,
      available:
        daily.dataStatus !== "UNAVAILABLE" && daily.dataStatus !== "MOCK",
      dataStatus: daily.dataStatus,
      trend: daily.trend,
      momentum: daily.momentum,
      reason: null,
    },
    setup: {
      timeframe: MTF_SETUP_TIMEFRAME,
      available: false,
      dataStatus: "UNAVAILABLE",
      trend: "UNKNOWN",
      momentum: "UNKNOWN",
      reason: "not_fetched",
    },
    entry: {
      timeframe: MTF_ENTRY_TIMEFRAME,
      available: false,
      dataStatus: "UNAVAILABLE",
      trend: "UNKNOWN",
      momentum: "UNKNOWN",
      reason: "not_fetched",
    },
    aligned: false,
    score: 50,
    notes: [
      "Higher-timeframe daily regime only — setup/entry frames not enriched yet",
    ],
  };
}

function frameStatus(
  snapshot: TechnicalSnapshot | null,
  errorReason: string | null,
): MtfFrameStatus {
  if (errorReason === "provider_rate_limit") {
    return {
      timeframe: "unknown",
      available: false,
      dataStatus: "UNAVAILABLE",
      trend: "UNKNOWN",
      momentum: "UNKNOWN",
      reason: "provider_rate_limit",
    };
  }
  if (!snapshot || snapshot.dataStatus === "UNAVAILABLE" || snapshot.dataStatus === "MOCK") {
    return {
      timeframe: snapshot?.timeframe ?? "unknown",
      available: false,
      dataStatus: snapshot?.dataStatus ?? "UNAVAILABLE",
      trend: snapshot?.trend ?? "UNKNOWN",
      momentum: snapshot?.momentum ?? "UNKNOWN",
      reason: errorReason ?? "data_unavailable",
    };
  }
  return {
    timeframe: snapshot.timeframe,
    available: true,
    dataStatus: snapshot.dataStatus,
    trend: snapshot.trend,
    momentum: snapshot.momentum,
    reason: null,
  };
}

function trendsAgree(a: string, b: string): boolean {
  if (a === "BULLISH" && b === "BULLISH") return true;
  if (a === "BEARISH" && b === "BEARISH") return true;
  return false;
}

/**
 * Score multi-timeframe alignment 0–100 from available frames only.
 * Missing frames do not invent agreement — they reduce confidence neutrally.
 */
export function scoreMtfAlignment(input: {
  daily: TechnicalSnapshot;
  setup: TechnicalSnapshot | null;
  entry: TechnicalSnapshot | null;
}): { score: number; alignment: MtfAlignment } {
  const daily = frameStatus(input.daily, null);
  const setupTf = frameStatus(input.setup, input.setup ? null : "timeframe_unavailable");
  const entryTf = frameStatus(input.entry, input.entry ? null : "timeframe_unavailable");

  let score = 50;
  let aligned = false;
  const notes: string[] = [];

  if (setupTf.available) {
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
    notes.push(`Setup timeframe (${MTF_SETUP_TIMEFRAME}) unavailable — using daily only`);
  }

  if (entryTf.available) {
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
    notes.push(`Entry timeframe (${MTF_ENTRY_TIMEFRAME}) unavailable`);
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    alignment: {
      daily,
      setup: setupTf,
      entry: entryTf,
      aligned,
      score: Math.min(100, Math.max(0, score)),
      notes,
    },
  };
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
