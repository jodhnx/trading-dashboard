import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import type { TradingSetup } from "@/engine/trading/types";
import type { ScoreBreakdown } from "@/engine/trading/score";
import {
  OPPORTUNITY_MIN,
  OPPORTUNITY_SCORE_WEIGHTS,
  STRONG_OPPORTUNITY_MIN,
  WATCH_MIN,
  type MarketRegime,
  type OpportunityScoreBreakdown,
  type OpportunityTier,
  type SetupType,
} from "./types";

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function weightTotal(): number {
  return Object.values(OPPORTUNITY_SCORE_WEIGHTS).reduce((sum, w) => sum + w, 0);
}

export function classifySetupType(input: {
  snapshot: TechnicalSnapshot;
  setup: TradingSetup;
  newsScore: number;
}): SetupType {
  if (input.setup.direction === "NO_TRADE" || input.setup.status !== "VALID") {
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

export function regimeAdjustmentScore(regime: MarketRegime, direction: string): number {
  if (regime === "UNKNOWN") return 50;
  if (regime === "HIGH_VOLATILITY") return 35;
  if (regime === "SIDEWAYS") return 45;
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
  return 40;
}

export function riskRewardScore(riskReward: number | null): number {
  if (riskReward === null || !(riskReward > 0)) return 0;
  if (riskReward >= 3) return 100;
  if (riskReward >= 2.5) return 90;
  if (riskReward >= 2) return 80;
  if (riskReward >= 1.5) return 55;
  return 25;
}

export function computeOpportunityScore(input: {
  technicalBreakdown: ScoreBreakdown;
  setup: TradingSetup;
  newsScore: number;
  catalystScore: number;
  sentimentScore: number;
  marketRegime: MarketRegime;
}): OpportunityScoreBreakdown {
  const technicalScore = clamp(input.technicalBreakdown.total);
  const momentumScore = clamp(input.technicalBreakdown.momentum);
  const volumeScore = clamp(input.technicalBreakdown.volume);
  const newsScore = clamp(input.newsScore);
  const catalystScore = clamp(input.catalystScore);
  const sentimentScore = clamp(input.sentimentScore);
  const marketRegimeScore = clamp(
    regimeAdjustmentScore(input.marketRegime, input.setup.direction),
  );
  const rrScore = riskRewardScore(input.setup.riskReward);

  const opportunityScore = clamp(
    (OPPORTUNITY_SCORE_WEIGHTS.technical * technicalScore +
      OPPORTUNITY_SCORE_WEIGHTS.momentum * momentumScore +
      OPPORTUNITY_SCORE_WEIGHTS.volume * volumeScore +
      OPPORTUNITY_SCORE_WEIGHTS.news * newsScore +
      OPPORTUNITY_SCORE_WEIGHTS.catalyst * catalystScore +
      OPPORTUNITY_SCORE_WEIGHTS.sentiment * sentimentScore +
      OPPORTUNITY_SCORE_WEIGHTS.marketRegime * marketRegimeScore +
      OPPORTUNITY_SCORE_WEIGHTS.riskReward * rrScore) /
      weightTotal(),
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
    opportunityScore,
    weights: OPPORTUNITY_SCORE_WEIGHTS,
  };
}

export function classifyOpportunityTier(input: {
  setup: TradingSetup;
  opportunityScore: number;
  dataStatus: string;
}): OpportunityTier {
  if (
    input.dataStatus === "UNAVAILABLE" ||
    input.dataStatus === "MOCK" ||
    input.dataStatus === "STALE" ||
    input.setup.direction === "NO_TRADE" ||
    input.setup.status !== "VALID"
  ) {
    return "NO_TRADE";
  }
  if (input.opportunityScore >= STRONG_OPPORTUNITY_MIN) {
    return "STRONG_OPPORTUNITY";
  }
  if (input.opportunityScore >= OPPORTUNITY_MIN) {
    return "OPPORTUNITY";
  }
  if (input.opportunityScore >= WATCH_MIN) {
    return "WATCH";
  }
  return "NO_TRADE";
}
