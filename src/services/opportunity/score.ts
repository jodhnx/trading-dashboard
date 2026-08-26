import type { ScoreBreakdown } from "@/engine/trading/score";
import type { TradingSetup } from "@/engine/trading/types";
import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import { hasRequiredTechnicalData } from "@/engine/trading/validation";
import {
  STRONG_OPPORTUNITY_MIN,
  WATCH_MIN,
  OPPORTUNITY_SCORE_WEIGHTS,
  opportunityScoreWeightsSum,
  type MarketRegime,
  type OpportunityScoreBreakdown,
  type OpportunityTier,
  type SetupType,
} from "./types";

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function classifySetupType(input: {
  snapshot: TechnicalSnapshot;
  setup: TradingSetup;
  newsScore: number;
}): SetupType {
  if (input.setup.direction === "NO_TRADE" || input.setup.status !== "VALID") {
    if (input.newsScore >= 75) return "CATALYST";
    if (input.snapshot.momentum === "STRONG" || input.snapshot.momentum === "WEAK") {
      return "MOMENTUM";
    }
    return "NO_SETUP";
  }
  if (input.newsScore >= 75) {
    return "CATALYST";
  }
  const { momentum, trend, technicalCondition } = input.snapshot;
  if (momentum === "STRONG" || momentum === "WEAK") {
    return "MOMENTUM";
  }
  if (technicalCondition === "UNFAVORABLE") {
    return "MEAN_REVERSION";
  }
  if (
    (trend === "BULLISH" && input.setup.direction === "LONG") ||
    (trend === "BEARISH" && input.setup.direction === "SHORT")
  ) {
    return "TREND_CONTINUATION";
  }
  if (trend === "BULLISH" && input.setup.direction === "SHORT") {
    return "REVERSAL";
  }
  if (trend === "BEARISH" && input.setup.direction === "LONG") {
    return "REVERSAL";
  }
  return "PULLBACK";
}

export function regimeAdjustmentScore(
  regime: MarketRegime,
  direction: string,
  confirmationLevel?: string | null,
): number {
  if (regime === "UNKNOWN") return 50;
  if (regime === "HIGH_VOLATILITY") return 35;
  if (regime === "SIDEWAYS") {
    if (confirmationLevel === "STRONG") return 55;
    if (confirmationLevel === "CONFIRMED") return 48;
    return 40;
  }
  if (direction === "LONG") {
    if (regime === "BULL" || regime === "RISK_ON") return 90;
    if (regime === "BEAR" || regime === "RISK_OFF") return 25;
    return 50;
  }
  if (direction === "SHORT") {
    if (regime === "BEAR" || regime === "RISK_OFF") return 90;
    if (regime === "BULL" || regime === "RISK_ON") return 25;
    return 50;
  }
  return 50;
}

export function riskRewardScore(riskReward: number | null): number {
  if (riskReward === null || !(riskReward > 0)) return 50;
  if (riskReward >= 3) return 100;
  if (riskReward >= 2.5) return 90;
  if (riskReward >= 2) return 80;
  if (riskReward >= 1.5) return 55;
  return 25;
}

/**
 * Weighted opportunity score. Weights sum to 100 — no 110/90 normalization.
 */
export function computeOpportunityScore(input: {
  technicalBreakdown: ScoreBreakdown;
  setup: TradingSetup;
  newsScore: number;
  catalystScore: number;
  sentimentScore: number;
  marketRegime: MarketRegime;
  multiTimeFrameScore?: number;
  /** @deprecated use multiTimeFrameScore */
  multiTimeframeScore?: number;
  freshnessFactor?: number;
}): OpportunityScoreBreakdown {
  const weightSum = opportunityScoreWeightsSum();
  if (weightSum !== 100) {
    throw new Error(
      `OPPORTUNITY_SCORE_WEIGHTS must sum to 100 (got ${weightSum})`,
    );
  }

  const technicalScore = clamp(input.technicalBreakdown.total);
  const momentumScore = clamp(input.technicalBreakdown.momentum);
  const volumeScore = clamp(input.technicalBreakdown.volume);
  const newsScore = clamp(input.newsScore);
  const catalystScore = clamp(input.catalystScore);
  const sentimentScore = clamp(input.sentimentScore);
  const marketRegimeScore = clamp(
    regimeAdjustmentScore(
      input.marketRegime,
      input.setup.direction,
      input.setup.confirmation?.confirmation,
    ),
  );
  const rrScore = riskRewardScore(input.setup.riskReward);
  const multiTimeFrameScore = clamp(
    input.multiTimeFrameScore ?? input.multiTimeframeScore ?? 50,
  );
  const freshnessFactor =
    typeof input.freshnessFactor === "number" &&
    Number.isFinite(input.freshnessFactor)
      ? Math.min(1, Math.max(0, input.freshnessFactor))
      : 1;

  const blended = clamp(
    (OPPORTUNITY_SCORE_WEIGHTS.technical * technicalScore +
      OPPORTUNITY_SCORE_WEIGHTS.momentum * momentumScore +
      OPPORTUNITY_SCORE_WEIGHTS.volume * volumeScore +
      OPPORTUNITY_SCORE_WEIGHTS.news * newsScore +
      OPPORTUNITY_SCORE_WEIGHTS.catalyst * catalystScore +
      OPPORTUNITY_SCORE_WEIGHTS.sentiment * sentimentScore +
      OPPORTUNITY_SCORE_WEIGHTS.marketRegime * marketRegimeScore +
      OPPORTUNITY_SCORE_WEIGHTS.riskReward * rrScore +
      OPPORTUNITY_SCORE_WEIGHTS.multiTimeFrame * multiTimeFrameScore) /
      100,
  );

  return {
    technicalScore,
    momentumScore,
    volumeScore,
    newsScore,
    catalystScore,
    sentimentScore,
    marketRegimeScore,
    riskRewardScore: rrScore,
    multiTimeFrameScore,
    multiTimeframeScore: multiTimeFrameScore,
    opportunityScore: clamp(blended * freshnessFactor),
    weights: OPPORTUNITY_SCORE_WEIGHTS,
  };
}

export type TierClassification = {
  tier: OpportunityTier;
  rejectionReason: string | null;
};

export function classifyOpportunityTier(input: {
  setup: TradingSetup;
  opportunityScore: number;
  dataStatus: string;
  hasTechnicals: boolean;
}): TierClassification {
  if (input.dataStatus === "UNAVAILABLE" || input.dataStatus === "MOCK") {
    return {
      tier: "NO_TRADE",
      rejectionReason: `data_${input.dataStatus.toLowerCase()}`,
    };
  }

  if (!input.hasTechnicals) {
    return {
      tier: "NO_TRADE",
      rejectionReason: "insufficient_technicals",
    };
  }

  const actionableSetup =
    input.setup.status === "VALID" &&
    (input.setup.direction === "LONG" || input.setup.direction === "SHORT");

  const freshEnough =
    input.dataStatus === "LIVE" || input.dataStatus === "CACHED";

  if (actionableSetup && freshEnough) {
    if (input.opportunityScore >= STRONG_OPPORTUNITY_MIN) {
      return { tier: "STRONG_OPPORTUNITY", rejectionReason: null };
    }
    return { tier: "OPPORTUNITY", rejectionReason: null };
  }

  if (actionableSetup && input.dataStatus === "STALE") {
    if (input.opportunityScore >= WATCH_MIN) {
      return { tier: "WATCH", rejectionReason: null };
    }
    return {
      tier: "NO_TRADE",
      rejectionReason: "stale_score_below_watch_min",
    };
  }

  if (
    (freshEnough || input.dataStatus === "STALE") &&
    input.opportunityScore >= WATCH_MIN
  ) {
    return { tier: "WATCH", rejectionReason: null };
  }

  if (input.setup.direction === "NO_TRADE") {
    return {
      tier: "NO_TRADE",
      rejectionReason: "engine_no_trade_low_score",
    };
  }

  return {
    tier: "NO_TRADE",
    rejectionReason: "setup_not_actionable",
  };
}

export function describeWaitingFor(input: {
  setup: TradingSetup;
  snapshot: TechnicalSnapshot;
}): string[] {
  if (
    input.setup.status === "VALID" &&
    (input.setup.direction === "LONG" || input.setup.direction === "SHORT")
  ) {
    return [];
  }

  const explain = input.setup.confirmation?.explain;
  if (explain) {
    return [explain];
  }

  const waiting: string[] = [];
  const { snapshot } = input;

  if (snapshot.trend === "NEUTRAL" || snapshot.trend === "UNKNOWN") {
    waiting.push("Trend is not directional");
  } else if (
    snapshot.trend === "BULLISH" &&
    snapshot.momentum !== "POSITIVE" &&
    snapshot.momentum !== "STRONG"
  ) {
    waiting.push("Missing bullish momentum");
  } else if (
    snapshot.trend === "BEARISH" &&
    snapshot.momentum !== "NEGATIVE" &&
    snapshot.momentum !== "WEAK"
  ) {
    waiting.push("Missing bearish momentum");
  } else {
    waiting.push("EMA/MACD confirmation missing");
  }

  return waiting.slice(0, 4);
}

export function snapshotHasTechnicals(snapshot: TechnicalSnapshot): boolean {
  return hasRequiredTechnicalData(snapshot);
}

export function isDataQualityRejection(reason: string | null): boolean {
  if (!reason) return false;
  return (
    reason.startsWith("data_") ||
    reason === "insufficient_technicals" ||
    reason === "provider_rate_limit" ||
    reason === "provider_unmapped" ||
    reason === "provider_error"
  );
}
