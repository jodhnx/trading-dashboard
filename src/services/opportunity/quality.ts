import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import type { TradingSetup } from "@/engine/trading/types";
import { evaluateSetupConfirmation } from "@/engine/trading/confirmation";
import { emaBearish, emaBullish } from "@/engine/trading/score";
import type { DataFreshness, SignalQuality } from "./types";

/**
 * Map provider dataStatus → product freshness.
 * Never treat CACHED/STALE as LIVE.
 * RECENT = CACHED with asOf within 6h (usable recent print, still not LIVE).
 */
export function toDataFreshness(
  dataStatus: string,
  asOfMs?: number | null,
  nowMs: number = Date.now(),
): DataFreshness {
  if (dataStatus === "LIVE") return "LIVE";
  if (dataStatus === "STALE") return "STALE";
  if (dataStatus === "CACHED") {
    if (
      typeof asOfMs === "number" &&
      Number.isFinite(asOfMs) &&
      nowMs - asOfMs >= 0 &&
      nowMs - asOfMs <= 6 * 60 * 60 * 1000
    ) {
      return "RECENT";
    }
    return "CACHED";
  }
  return "UNAVAILABLE";
}

export function freshnessAllowsConfirmed(freshness: DataFreshness): boolean {
  return (
    freshness === "LIVE" || freshness === "RECENT" || freshness === "CACHED"
  );
}

/** Confidence penalty for non-LIVE evidence (ranking may still use cached). */
export function freshnessConfidenceFactor(freshness: DataFreshness): number {
  switch (freshness) {
    case "LIVE":
      return 1;
    case "RECENT":
      return 0.97;
    case "CACHED":
      return 0.9;
    case "STALE":
      return 0.75;
    default:
      return 0;
  }
}

function momentumDirectional(snapshot: TechnicalSnapshot): boolean {
  return (
    snapshot.momentum === "POSITIVE" ||
    snapshot.momentum === "STRONG" ||
    snapshot.momentum === "NEGATIVE" ||
    snapshot.momentum === "WEAK"
  );
}

function hasDirectionalTrend(snapshot: TechnicalSnapshot): boolean {
  return snapshot.trend === "BULLISH" || snapshot.trend === "BEARISH";
}

function hasEmaOrMacdHint(snapshot: TechnicalSnapshot): boolean {
  if (snapshot.trend === "BULLISH") {
    return (
      emaBullish(snapshot) ||
      (snapshot.macdHistogram !== null && snapshot.macdHistogram > 0)
    );
  }
  if (snapshot.trend === "BEARISH") {
    return (
      emaBearish(snapshot) ||
      (snapshot.macdHistogram !== null && snapshot.macdHistogram < 0)
    );
  }
  return emaBullish(snapshot) || emaBearish(snapshot);
}

/**
 * Phase 22 signal quality — does NOT loosen Phase 21 confirmation for VALID trades.
 * EARLY_SETUP surfaces developing evidence for ranking only (not a buy/sell instruction).
 */
export function classifySignalQuality(input: {
  setup: TradingSetup;
  snapshot: TechnicalSnapshot;
  dataFreshness: DataFreshness;
  mtfAligned: boolean;
}): SignalQuality {
  if (
    input.dataFreshness === "UNAVAILABLE" ||
    input.snapshot.dataStatus === "UNAVAILABLE" ||
    input.snapshot.dataStatus === "MOCK"
  ) {
    return "NO_TRADE";
  }

  const conf =
    input.setup.confirmation ?? evaluateSetupConfirmation(input.snapshot);
  const validSetup =
    input.setup.status === "VALID" &&
    (input.setup.direction === "LONG" || input.setup.direction === "SHORT") &&
    input.setup.entry !== null &&
    input.setup.stopLoss !== null &&
    input.setup.takeProfit !== null &&
    input.setup.riskReward !== null &&
    input.setup.riskReward > 0;

  // STRONG / CONFIRMED require a VALID engine setup with levels (never invent).
  if (validSetup && freshnessAllowsConfirmed(input.dataFreshness)) {
    if (
      conf.confirmation === "STRONG" &&
      conf.atrValid &&
      (input.setup.confirmation?.rrValid !== false)
    ) {
      return "STRONG";
    }
    if (conf.confirmation === "STRONG" || conf.confirmation === "CONFIRMED") {
      return "CONFIRMED";
    }
  }

  // STALE valid setups cannot be CONFIRMED/STRONG
  if (validSetup && input.dataFreshness === "STALE") {
    return "EARLY_SETUP";
  }

  // EARLY_SETUP: directional trend + confirming hint, but Phase 21 confirmation incomplete
  // (e.g. AMD: BULLISH + NEUTRAL momentum + EMA bullish).
  if (
    hasDirectionalTrend(input.snapshot) &&
    hasEmaOrMacdHint(input.snapshot) &&
    (freshnessAllowsConfirmed(input.dataFreshness) ||
      input.dataFreshness === "STALE")
  ) {
    if (!momentumDirectional(input.snapshot) || conf.confirmation === "WATCH") {
      return "EARLY_SETUP";
    }
    if (conf.confirmation === "CONFIRMED" || conf.confirmation === "STRONG") {
      // Confirmed direction but setup invalid (RR/score/stale) → early, not fake trade
      return "EARLY_SETUP";
    }
  }

  if (
    hasDirectionalTrend(input.snapshot) ||
    momentumDirectional(input.snapshot) ||
    input.mtfAligned
  ) {
    return "WATCH";
  }

  return "NO_TRADE";
}

export function qualityRank(quality: SignalQuality): number {
  switch (quality) {
    case "STRONG":
      return 5;
    case "CONFIRMED":
      return 4;
    case "EARLY_SETUP":
      return 3;
    case "WATCH":
      return 2;
    case "NO_TRADE":
      return 1;
    default:
      return 0;
  }
}

/** High-confidence bestStock / bestCrypto only — never EARLY_SETUP as a forced trade. */
export function isHighConfidenceQuality(quality: SignalQuality): boolean {
  return quality === "STRONG" || quality === "CONFIRMED";
}

/** Ranked board candidates (includes developing setups). */
export function isRankedBoardQuality(quality: SignalQuality): boolean {
  return (
    quality === "STRONG" ||
    quality === "CONFIRMED" ||
    quality === "EARLY_SETUP" ||
    quality === "WATCH"
  );
}
