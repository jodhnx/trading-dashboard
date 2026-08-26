import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import {
  ACTIVE_CONFIRMATION_RULE,
  LEGACY_CONFIRMATION_RULE,
  evaluateSetupConfirmation,
  macdNegative,
  macdPositive,
  momentumBearish,
  momentumBullish,
} from "@/engine/trading/confirmation";
import { emaBearish, emaBullish } from "@/engine/trading/score";
import type { TradingSetup } from "@/engine/trading/types";

export const SIGNAL_BLOCKER_CODES = [
  "INSUFFICIENT_DATA",
  "ATR_MISSING",
  "TREND_NOT_DIRECTIONAL",
  "MOMENTUM_NOT_ALIGNED",
  "EMA_MACD_CONFIRMATION_MISSING",
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
  firstBlocker: SignalBlockerCode | null;
  confirmationLevel: string;
  /** Legacy all-four rule (diagnostic comparison only). */
  legacyAllFourWouldPass: boolean;
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
  currentConfirmationRule: string;
  activeConfirmationRule: string;
  alternativeConfirmationRule: string;
  liveOrCachedEvaluated: number;
  currentValid: number;
  alternativeValid: number;
  strongConfirmationCount: number;
  confirmedCount: number;
  watchCount: number;
  note: string;
};

export type SignalDiagnosticsReport = {
  liveAssets: number;
  validSetups: number;
  watchCandidates: number;
  dataSkipped: number;
  skipReasons: Record<string, number>;
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

function legacyAllFourPass(snapshot: TechnicalSnapshot): boolean {
  const long =
    snapshot.trend === "BULLISH" &&
    momentumBullish(snapshot) &&
    emaBullish(snapshot) &&
    macdPositive(snapshot);
  const short =
    snapshot.trend === "BEARISH" &&
    momentumBearish(snapshot) &&
    emaBearish(snapshot) &&
    macdNegative(snapshot);
  return (long && !short) || (short && !long);
}

/**
 * First blocker under ACTIVE confirmation rule (trend + momentum + EMA|MACD).
 */
export function findFirstDirectionBlocker(
  snapshot: TechnicalSnapshot,
): SignalBlockerCode | null {
  const conf = evaluateSetupConfirmation(snapshot);
  if (!conf.atrValid) {
    if (snapshot.atr14 === null || !(snapshot.atr14 > 0)) return "ATR_MISSING";
    return "INSUFFICIENT_DATA";
  }
  if (conf.direction === "LONG" || conf.direction === "SHORT") {
    return null;
  }
  if (conf.explain.includes("Trend is not directional")) {
    return "TREND_NOT_DIRECTIONAL";
  }
  if (
    conf.explain.startsWith("Missing") &&
    conf.explain.toLowerCase().includes("momentum")
  ) {
    return "MOMENTUM_NOT_ALIGNED";
  }
  if (conf.explain.includes("EMA/MACD")) {
    return "EMA_MACD_CONFIRMATION_MISSING";
  }
  if (conf.explain.includes("ATR")) {
    return "ATR_MISSING";
  }
  return "OTHER";
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
  const conf =
    input.setup?.confirmation ?? evaluateSetupConfirmation(snapshot);
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
    } else if (
      snapshot.dataStatus === "STALE" &&
      input.setup?.rejectReasons.includes("STALE_DATA")
    ) {
      firstBlocker = "STALE_OR_REJECTED_DATA";
    } else if (input.setup?.rejectReasons.includes("INVALID_RR")) {
      firstBlocker = "INVALID_RR";
    } else if (
      input.setup?.score !== null &&
      input.setup?.score !== undefined &&
      input.setup.score < 60 &&
      (engineDirection === "LONG" || engineDirection === "SHORT")
    ) {
      firstBlocker = "SCORE_BELOW_MIN";
    } else {
      firstBlocker = findFirstDirectionBlocker(snapshot);
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
    confirmationLevel: conf.confirmation,
    legacyAllFourWouldPass: legacyAllFourPass(snapshot),
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
      case "EMA_MACD_CONFIRMATION_MISSING":
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

export function countSkipReasons(
  diagnostics: Array<{ tier: string; rejectionReason: string | null }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of diagnostics) {
    if (item.tier !== "DATA_SKIP") continue;
    const key = item.rejectionReason ?? "data_unavailable";
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
  if (a.emaBlocked > 0) parts.push(`EMA/MACD confirm (${a.emaBlocked})`);
  if (a.macdBlocked > 0) parts.push(`MACD (${a.macdBlocked})`);
  if (a.atrBlocked > 0) parts.push(`ATR (${a.atrBlocked})`);
  if (a.insufficientData > 0) parts.push(`insufficient data (${a.insufficientData})`);
  if (a.other > 0) parts.push(`other (${a.other})`);

  if (parts.length > 0) {
    messages.push(`No VALID LONG/SHORT: first blockers — ${parts.join(", ")}.`);
  } else if (input.boardState === "DATA_INSUFFICIENT") {
    messages.push(
      "No usable LIVE/CACHED technicals — provider/data gap, not a trading call.",
    );
  } else {
    messages.push("No VALID setups after confirmation model evaluation.");
  }

  messages.push(
    `Active rule: ${input.confirmationSimulation.activeConfirmationRule} → ${input.confirmationSimulation.currentValid} valid. Legacy all-four would yield ${input.confirmationSimulation.alternativeValid}. Strong ${input.confirmationSimulation.strongConfirmationCount} / confirmed ${input.confirmationSimulation.confirmedCount}.`,
  );

  return messages;
}

export function buildSignalDiagnosticsReport(input: {
  boardState: string;
  diagnostics: SignalAssetDiagnostic[];
  candidateDiagnostics: Array<{ tier: string; rejectionReason: string | null }>;
  dataSkipped: number;
}): SignalDiagnosticsReport {
  const liveOrCached = input.diagnostics.filter(
    (d) => d.technicalStatus === "LIVE" || d.technicalStatus === "CACHED",
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

  const strongConfirmationCount = liveOrCached.filter(
    (d) => d.confirmationLevel === "STRONG",
  ).length;
  const confirmedCount = liveOrCached.filter(
    (d) => d.confirmationLevel === "CONFIRMED",
  ).length;

  const confirmationSimulation: ConfirmationSimulation = {
    currentConfirmationRule: LEGACY_CONFIRMATION_RULE,
    activeConfirmationRule: ACTIVE_CONFIRMATION_RULE,
    alternativeConfirmationRule: LEGACY_CONFIRMATION_RULE,
    liveOrCachedEvaluated: liveOrCached.length,
    currentValid: liveOrCached.filter(
      (d) =>
        d.engineStatus === "VALID" &&
        (d.engineDirection === "LONG" || d.engineDirection === "SHORT"),
    ).length,
    alternativeValid: liveOrCached.filter((d) => d.legacyAllFourWouldPass).length,
    strongConfirmationCount,
    confirmedCount,
    watchCount: liveOrCached.filter((d) => d.confirmationLevel === "WATCH").length,
    note: "Active engine rule is trend + momentum + (EMA OR MACD). alternativeValid = legacy all-four count.",
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
    skipReasons: countSkipReasons(input.candidateDiagnostics),
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
