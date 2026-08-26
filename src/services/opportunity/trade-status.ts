import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import type { TradingSetup } from "@/engine/trading/types";
import { evaluateSetupConfirmation } from "@/engine/trading/confirmation";
import { emaBearish, emaBullish } from "@/engine/trading/score";
import type { DataFreshness, SignalQuality } from "./types";

/**
 * Technical confirmation (pre trade-eligibility gate).
 * Does NOT imply a trade is allowed — see TradeStatus.
 */
export const TECHNICAL_CONFIRMATIONS = [
  "NONE",
  "WATCH",
  "EARLY_SETUP",
  "STRONG",
] as const;
export type TechnicalConfirmation = (typeof TECHNICAL_CONFIRMATIONS)[number];

export const TRADE_STATUSES = ["ELIGIBLE", "BLOCKED", "NO_TRADE"] as const;
export type TradeStatus = (typeof TRADE_STATUSES)[number];

export const TRADE_BLOCK_REASONS = [
  "INVALID_RR",
  "TREND_NOT_DIRECTIONAL",
  "MOMENTUM_NOT_ALIGNED",
  "INSUFFICIENT_DATA",
  "ATR_INVALID",
  "EMA_BLOCKED",
  "MACD_BLOCKED",
  "NON_TRADEABLE_ASSET_CLASS",
  "DATA_UNAVAILABLE",
  "PROVIDER_UNMAPPED",
  "OTHER",
] as const;
export type TradeBlockReason = (typeof TRADE_BLOCK_REASONS)[number];

export type TradeEligibility = {
  /** Technical confirmation before eligibility gates. */
  technicalConfirmation: TechnicalConfirmation;
  /** Engine confirmation level (STRONG | CONFIRMED | WATCH) for compat. */
  engineConfirmation: "STRONG" | "CONFIRMED" | "WATCH" | "NONE";
  tradeStatus: TradeStatus;
  blockReason: TradeBlockReason | null;
  /** Direction from technical confirmation when directional; else NONE. */
  signalDirection: "LONG" | "SHORT" | "NONE";
  /** Product quality for board/API (ELIGIBLE STRONG→STRONG, BLOCKED→NO_TRADE). */
  quality: SignalQuality;
};

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

function mapRejectToBlockReason(
  rejectReasons: string[],
  snapshot: TechnicalSnapshot,
  confExplain: string,
): TradeBlockReason {
  // Prefer confirmation explain for directional blockers over generic rejects.
  if (confExplain.includes("Trend is not directional")) {
    return "TREND_NOT_DIRECTIONAL";
  }
  if (
    confExplain.toLowerCase().includes("momentum") &&
    confExplain.toLowerCase().startsWith("missing")
  ) {
    return "MOMENTUM_NOT_ALIGNED";
  }
  if (rejectReasons.includes("INVALID_RR")) return "INVALID_RR";
  if (
    snapshot.atr14 === null ||
    !(snapshot.atr14 > 0) ||
    confExplain.toLowerCase().includes("atr")
  ) {
    return "ATR_INVALID";
  }
  if (rejectReasons.includes("INSUFFICIENT_DATA")) return "INSUFFICIENT_DATA";
  if (rejectReasons.includes("STALE_DATA") || rejectReasons.includes("MOCK_DATA")) {
    return "DATA_UNAVAILABLE";
  }
  if (confExplain.includes("EMA/MACD") || confExplain.includes("EMA")) {
    return "EMA_BLOCKED";
  }
  if (confExplain.toLowerCase().includes("macd")) {
    return "MACD_BLOCKED";
  }
  return "OTHER";
}

/**
 * Separate technical confirmation from trade eligibility.
 * Phase 21 confirmation rules are unchanged — this only classifies outcomes.
 *
 * Example META (STRONG tech, bad RR):
 *   technicalConfirmation=STRONG, tradeStatus=BLOCKED, blockReason=INVALID_RR, quality=NO_TRADE
 */
export function evaluateTradeEligibility(input: {
  setup: TradingSetup;
  snapshot: TechnicalSnapshot;
  dataFreshness: DataFreshness;
}): TradeEligibility {
  const { setup, snapshot, dataFreshness } = input;

  if (
    dataFreshness === "UNAVAILABLE" ||
    snapshot.dataStatus === "UNAVAILABLE" ||
    snapshot.dataStatus === "MOCK"
  ) {
    return {
      technicalConfirmation: "NONE",
      engineConfirmation: "NONE",
      tradeStatus: "NO_TRADE",
      blockReason: "DATA_UNAVAILABLE",
      signalDirection: "NONE",
      quality: "NO_TRADE",
    };
  }

  const conf = setup.confirmation ?? evaluateSetupConfirmation(snapshot);
  const engineConfirmation = conf.confirmation;
  const signalDirection =
    conf.direction === "LONG" || conf.direction === "SHORT"
      ? conf.direction
      : "NONE";

  const eligibleSetup =
    setup.status === "VALID" &&
    (setup.direction === "LONG" || setup.direction === "SHORT") &&
    setup.entry !== null &&
    setup.stopLoss !== null &&
    setup.takeProfit !== null &&
    setup.riskReward !== null &&
    setup.riskReward > 0 &&
    (dataFreshness === "LIVE" ||
      dataFreshness === "RECENT" ||
      dataFreshness === "CACHED");

  // Technical STRONG = engine STRONG or CONFIRMED (Phase 21 confirmation satisfied).
  const technicalStrong =
    conf.confirmation === "STRONG" || conf.confirmation === "CONFIRMED";

  if (eligibleSetup) {
    const quality: SignalQuality =
      conf.confirmation === "STRONG" ? "STRONG" : "CONFIRMED";
    return {
      technicalConfirmation: "STRONG",
      engineConfirmation,
      tradeStatus: "ELIGIBLE",
      blockReason: null,
      signalDirection:
        setup.direction === "LONG" || setup.direction === "SHORT"
          ? setup.direction
          : signalDirection,
      quality,
    };
  }

  // Technically confirmed but final gates blocked (e.g. INVALID_RR / STALE).
  if (technicalStrong) {
    let blockReason = mapRejectToBlockReason(
      setup.rejectReasons,
      snapshot,
      conf.explain,
    );
    if (dataFreshness === "STALE") {
      blockReason = "DATA_UNAVAILABLE";
    } else if (setup.rejectReasons.includes("INVALID_RR")) {
      blockReason = "INVALID_RR";
    }
    return {
      technicalConfirmation: "STRONG",
      engineConfirmation,
      tradeStatus: "BLOCKED",
      blockReason,
      signalDirection:
        setup.direction === "LONG" || setup.direction === "SHORT"
          ? setup.direction
          : signalDirection,
      quality: "NO_TRADE",
    };
  }

  // EARLY_SETUP: directional + hint, confirmation incomplete (e.g. AMD).
  if (
    hasDirectionalTrend(snapshot) &&
    hasEmaOrMacdHint(snapshot) &&
    (dataFreshness === "LIVE" ||
      dataFreshness === "RECENT" ||
      dataFreshness === "CACHED" ||
      dataFreshness === "STALE")
  ) {
    if (!momentumDirectional(snapshot) || conf.confirmation === "WATCH") {
      return {
        technicalConfirmation: "EARLY_SETUP",
        engineConfirmation,
        tradeStatus: "NO_TRADE",
        blockReason: mapRejectToBlockReason(
          setup.rejectReasons,
          snapshot,
          conf.explain,
        ),
        signalDirection: "NONE",
        quality: "EARLY_SETUP",
      };
    }
  }

  if (hasDirectionalTrend(snapshot) || momentumDirectional(snapshot)) {
    return {
      technicalConfirmation: "WATCH",
      engineConfirmation,
      tradeStatus: "NO_TRADE",
      blockReason: mapRejectToBlockReason(
        setup.rejectReasons.length > 0 ? setup.rejectReasons : [],
        snapshot,
        conf.explain,
      ),
      signalDirection: "NONE",
      quality: "WATCH",
    };
  }

  return {
    technicalConfirmation: "WATCH",
    engineConfirmation,
    tradeStatus: "NO_TRADE",
    blockReason: "TREND_NOT_DIRECTIONAL",
    signalDirection: "NONE",
    quality: "NO_TRADE",
  };
}
