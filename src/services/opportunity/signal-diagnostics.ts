import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import { emaBearish, emaBullish } from "@/engine/trading/score";
import { hasRequiredTechnicalData } from "@/engine/trading/validation";
import type { TradingSetup } from "@/engine/trading/types";

export const SIGNAL_BLOCKER_CODES = [
  "INSUFFICIENT_DATA",
  "ATR_MISSING",
  "TREND_NOT_DIRECTIONAL",
  "MOMENTUM_NOT_ALIGNED",
  "EMA_NOT_ALIGNED",
  "MACD_NOT_CONFIRMED",
  "SCORE_BELOW_MIN",
  "STALE_OR_REJECTED_DATA",
  "INVALID_RR",
  "OTHER",
] as const;
export type SignalBlockerCode = (typeof SIGNAL_BLOCKER_CODES)[number];

export type SignalAssetDiagnostic = {
  symbol: string;
  assetType: string;
  quoteStatus: string;
  technicalStatus: string;
  trend: string;
  momentum: string;
  emaAlignment: "BULLISH" | "BEARISH" | "NONE";
  macd: "POSITIVE" | "NEGATIVE" | "FLAT" | "MISSING";
  atr: number | null;
  engineDirection: string;
  engineStatus: string;
  engineScore: number | null;
  opportunityScore: number | null;
  tier: string;
  rejectionReason: string | null;
  /** First condition that prevents VALID LONG or VALID SHORT under current engine rules. */
  firstBlocker: SignalBlockerCode | null;
  /** Would pass under diagnostic "trend + momentum + (EMA or MACD)" simulation. */
  altConfirmationWouldPass: boolean;
  altConfirmationDirection: "LONG" | "SHORT" | "NO_TRADE";
};

export type SignalBlockerAggregate = {
  trendBlocked: number;
  momentumBlocked: number;
  emaBlocked: number;
  macdBlocked: number;
  atrBlocked: number;
  insufficientData: number;
  other: number;
};

export type ConfirmationSimulation = {
  currentRule: string;
  alternativeRule: string;
  liveOrCachedEvaluated: number;
  currentValid: number;
  alternativeValid: number;
  note: string;
};

export type SignalDiagnosticsReport = {
  liveAssets: number;
  validSetups: number;
  watchCandidates: number;
  dataSkipped: number;
  blockerAggregate: SignalBlockerAggregate;
  rejectionReasons: Record<string, number>;
  confirmationSimulation: ConfirmationSimulation;
  liveDiagnostics: SignalAssetDiagnostic[];
  whyNoSetup: string[];
};

function macdState(
  snapshot: TechnicalSnapshot,
): "POSITIVE" | "NEGATIVE" | "FLAT" | "MISSING" {
  if (snapshot.macdHistogram === null) return "MISSING";
  if (snapshot.macdHistogram > 0) return "POSITIVE";
  if (snapshot.macdHistogram < 0) return "NEGATIVE";
  return "FLAT";
}

function emaAlignment(
  snapshot: TechnicalSnapshot,
): "BULLISH" | "BEARISH" | "NONE" {
  if (emaBullish(snapshot)) return "BULLISH";
  if (emaBearish(snapshot)) return "BEARISH";
  return "NONE";
}

function longMomentumOk(snapshot: TechnicalSnapshot): boolean {
  return snapshot.momentum === "POSITIVE" || snapshot.momentum === "STRONG";
}

function shortMomentumOk(snapshot: TechnicalSnapshot): boolean {
  return snapshot.momentum === "NEGATIVE" || snapshot.momentum === "WEAK";
}

function macdLongOk(snapshot: TechnicalSnapshot): boolean {
  return snapshot.macdHistogram !== null && snapshot.macdHistogram > 0;
}

function macdShortOk(snapshot: TechnicalSnapshot): boolean {
  return snapshot.macdHistogram !== null && snapshot.macdHistogram < 0;
}

/**
 * Ordered first-blocker under CURRENT engine rules
 * (trend AND momentum AND EMA AND MACD must all agree).
 * Does not mutate the Trading Engine.
 */
export function findFirstDirectionBlocker(
  snapshot: TechnicalSnapshot,
): SignalBlockerCode | null {
  if (!hasRequiredTechnicalData(snapshot)) {
    if (snapshot.atr14 === null || !(snapshot.atr14 > 0)) {
      return "ATR_MISSING";
    }
    return "INSUFFICIENT_DATA";
  }

  const bullishBias =
    snapshot.trend === "BULLISH" ||
    (snapshot.trend !== "BEARISH" &&
      (longMomentumOk(snapshot) || emaBullish(snapshot) || macdLongOk(snapshot)));
  const bearishBias =
    snapshot.trend === "BEARISH" ||
    (snapshot.trend !== "BULLISH" &&
      (shortMomentumOk(snapshot) || emaBearish(snapshot) || macdShortOk(snapshot)));

  // Prefer evaluating the bias that has more partial confirmation
  const tryLongFirst =
    snapshot.trend === "BULLISH" ||
    (snapshot.trend !== "BEARISH" && bullishBias && !bearishBias) ||
    (snapshot.trend === "NEUTRAL" &&
      Number(longMomentumOk(snapshot)) +
        Number(emaBullish(snapshot)) +
        Number(macdLongOk(snapshot)) >=
        Number(shortMomentumOk(snapshot)) +
          Number(emaBearish(snapshot)) +
          Number(macdShortOk(snapshot)));

  if (tryLongFirst) {
    if (snapshot.trend !== "BULLISH") return "TREND_NOT_DIRECTIONAL";
    if (!longMomentumOk(snapshot)) return "MOMENTUM_NOT_ALIGNED";
    if (!emaBullish(snapshot)) return "EMA_NOT_ALIGNED";
    if (!macdLongOk(snapshot)) return "MACD_NOT_CONFIRMED";
    return null;
  }

  if (snapshot.trend !== "BEARISH") return "TREND_NOT_DIRECTIONAL";
  if (!shortMomentumOk(snapshot)) return "MOMENTUM_NOT_ALIGNED";
  if (!emaBearish(snapshot)) return "EMA_NOT_ALIGNED";
  if (!macdShortOk(snapshot)) return "MACD_NOT_CONFIRMED";
  return null;
}

/**
 * Diagnostic-only alternative: trend + momentum + (EMA OR MACD).
 * Never used for live trading decisions in this phase.
 */
export function simulateAltConfirmation(snapshot: TechnicalSnapshot): {
  direction: "LONG" | "SHORT" | "NO_TRADE";
  wouldPass: boolean;
} {
  if (!hasRequiredTechnicalData(snapshot)) {
    return { direction: "NO_TRADE", wouldPass: false };
  }

  const longOk =
    snapshot.trend === "BULLISH" &&
    longMomentumOk(snapshot) &&
    (emaBullish(snapshot) || macdLongOk(snapshot));

  const shortOk =
    snapshot.trend === "BEARISH" &&
    shortMomentumOk(snapshot) &&
    (emaBearish(snapshot) || macdShortOk(snapshot));

  if (longOk && !shortOk) return { direction: "LONG", wouldPass: true };
  if (shortOk && !longOk) return { direction: "SHORT", wouldPass: true };
  return { direction: "NO_TRADE", wouldPass: false };
}

export function buildSignalAssetDiagnostic(input: {
  symbol: string;
  assetType: string;
  quoteStatus: string;
  snapshot: TechnicalSnapshot;
  setup: TradingSetup | null;
  opportunityScore: number | null;
  tier: string;
  rejectionReason: string | null;
}): SignalAssetDiagnostic {
  const { snapshot } = input;
  const alt = simulateAltConfirmation(snapshot);
  const engineDirection = input.setup?.direction ?? "NO_TRADE";
  const engineStatus = input.setup?.status ?? "SKIPPED";
  const isValid =
    input.setup?.status === "VALID" &&
    (engineDirection === "LONG" || engineDirection === "SHORT");

  let firstBlocker: SignalBlockerCode | null = null;
  if (!isValid) {
    if (
      snapshot.dataStatus === "UNAVAILABLE" ||
      snapshot.dataStatus === "MOCK"
    ) {
      firstBlocker = "INSUFFICIENT_DATA";
    } else if (snapshot.dataStatus === "STALE" && input.setup?.rejectReasons.includes("STALE_DATA")) {
      firstBlocker = "STALE_OR_REJECTED_DATA";
    } else if (input.setup?.rejectReasons.includes("INVALID_RR")) {
      firstBlocker = "INVALID_RR";
    } else if (
      input.setup?.rejectReasons.includes("NO_TECHNICAL_EDGE") ||
      engineDirection === "NO_TRADE"
    ) {
      firstBlocker = findFirstDirectionBlocker(snapshot);
    } else if (
      input.setup?.score !== null &&
      input.setup?.score !== undefined &&
      input.setup.score < 60
    ) {
      firstBlocker = "SCORE_BELOW_MIN";
    } else {
      firstBlocker = findFirstDirectionBlocker(snapshot) ?? "OTHER";
    }
  }

  return {
    symbol: input.symbol,
    assetType: input.assetType,
    quoteStatus: input.quoteStatus,
    technicalStatus: snapshot.dataStatus,
    trend: snapshot.trend,
    momentum: snapshot.momentum,
    emaAlignment: emaAlignment(snapshot),
    macd: macdState(snapshot),
    atr: snapshot.atr14,
    engineDirection,
    engineStatus,
    engineScore: input.setup?.score ?? null,
    opportunityScore: input.opportunityScore,
    tier: input.tier,
    rejectionReason: input.rejectionReason ?? firstBlocker,
    firstBlocker,
    altConfirmationWouldPass: alt.wouldPass,
    altConfirmationDirection: alt.direction,
  };
}

export function aggregateBlockers(
  diagnostics: SignalAssetDiagnostic[],
): SignalBlockerAggregate {
  const agg: SignalBlockerAggregate = {
    trendBlocked: 0,
    momentumBlocked: 0,
    emaBlocked: 0,
    macdBlocked: 0,
    atrBlocked: 0,
    insufficientData: 0,
    other: 0,
  };

  for (const item of diagnostics) {
    switch (item.firstBlocker) {
      case "TREND_NOT_DIRECTIONAL":
        agg.trendBlocked += 1;
        break;
      case "MOMENTUM_NOT_ALIGNED":
        agg.momentumBlocked += 1;
        break;
      case "EMA_NOT_ALIGNED":
        agg.emaBlocked += 1;
        break;
      case "MACD_NOT_CONFIRMED":
        agg.macdBlocked += 1;
        break;
      case "ATR_MISSING":
        agg.atrBlocked += 1;
        break;
      case "INSUFFICIENT_DATA":
        agg.insufficientData += 1;
        break;
      case null:
        break;
      default:
        agg.other += 1;
        break;
    }
  }
  return agg;
}

export function countRejectionReasons(
  diagnostics: SignalAssetDiagnostic[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of diagnostics) {
    const key = item.firstBlocker ?? item.rejectionReason ?? "OTHER";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function buildWhyNoSetupMessages(input: {
  boardState: string;
  aggregate: SignalBlockerAggregate;
  confirmationSimulation: ConfirmationSimulation;
  validSetups: number;
}): string[] {
  if (input.validSetups > 0) {
    return ["Valid setups exist — see Top Stock / Top Crypto sections."];
  }

  const messages: string[] = [];
  const a = input.aggregate;
  const parts: string[] = [];
  if (a.trendBlocked > 0) parts.push(`trend (${a.trendBlocked})`);
  if (a.momentumBlocked > 0) parts.push(`momentum (${a.momentumBlocked})`);
  if (a.emaBlocked > 0) parts.push(`EMA alignment (${a.emaBlocked})`);
  if (a.macdBlocked > 0) parts.push(`MACD (${a.macdBlocked})`);
  if (a.atrBlocked > 0) parts.push(`ATR (${a.atrBlocked})`);
  if (a.insufficientData > 0) parts.push(`insufficient data (${a.insufficientData})`);
  if (a.other > 0) parts.push(`other (${a.other})`);

  if (parts.length > 0) {
    messages.push(
      `No VALID LONG/SHORT: first blockers — ${parts.join(", ")}.`,
    );
  } else if (input.boardState === "DATA_INSUFFICIENT") {
    messages.push(
      "No usable LIVE/CACHED technicals — provider/data gap, not a trading call.",
    );
  } else {
    messages.push("No VALID setups after full indicator confirmation.");
  }

  messages.push(
    `Engine requires ${input.confirmationSimulation.currentRule}. Alternative simulation (${input.confirmationSimulation.alternativeRule}) would yield ${input.confirmationSimulation.alternativeValid} vs current ${input.confirmationSimulation.currentValid} valid directions among evaluated LIVE/CACHED assets.`,
  );

  return messages;
}

export function buildSignalDiagnosticsReport(input: {
  boardState: string;
  diagnostics: SignalAssetDiagnostic[];
  dataSkipped: number;
}): SignalDiagnosticsReport {
  const liveOrCached = input.diagnostics.filter(
    (d) =>
      d.technicalStatus === "LIVE" ||
      d.technicalStatus === "CACHED",
  );
  const liveDiagnostics = input.diagnostics.filter(
    (d) => d.technicalStatus === "LIVE" || d.quoteStatus === "LIVE",
  );
  const validSetups = input.diagnostics.filter(
    (d) =>
      d.engineStatus === "VALID" &&
      (d.engineDirection === "LONG" || d.engineDirection === "SHORT"),
  ).length;
  const watchCandidates = input.diagnostics.filter((d) => d.tier === "WATCH").length;

  const confirmationSimulation: ConfirmationSimulation = {
    currentRule: "trend + momentum + EMA + MACD (all must agree)",
    alternativeRule: "trend + momentum + (EMA or MACD)",
    liveOrCachedEvaluated: liveOrCached.length,
    currentValid: liveOrCached.filter(
      (d) =>
        d.engineStatus === "VALID" &&
        (d.engineDirection === "LONG" || d.engineDirection === "SHORT"),
    ).length,
    alternativeValid: liveOrCached.filter((d) => d.altConfirmationWouldPass).length,
    note: "Alternative counts are diagnostic only — Trading Engine rules unchanged in Phase 20.",
  };

  const blockerAggregate = aggregateBlockers(
    liveOrCached.filter(
      (d) =>
        !(
          d.engineStatus === "VALID" &&
          (d.engineDirection === "LONG" || d.engineDirection === "SHORT")
        ),
    ),
  );

  return {
    liveAssets: liveDiagnostics.length,
    validSetups,
    watchCandidates,
    dataSkipped: input.dataSkipped,
    blockerAggregate,
    rejectionReasons: countRejectionReasons(liveOrCached),
    confirmationSimulation,
    liveDiagnostics: liveDiagnostics.slice(0, 40),
    whyNoSetup: buildWhyNoSetupMessages({
      boardState: input.boardState,
      aggregate: blockerAggregate,
      confirmationSimulation,
      validSetups,
    }),
  };
}
