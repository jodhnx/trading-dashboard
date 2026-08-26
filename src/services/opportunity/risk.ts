import type { CatalogAsset } from "@/services/universe/types";
import type { RankedOpportunity } from "./types";
import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";

export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "EXTREME", "UNKNOWN"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const DEFAULT_RISK_PERCENT_BY_LEVEL: Record<
  Exclude<RiskLevel, "UNKNOWN">,
  number
> = {
  LOW: 0.01,
  MEDIUM: 0.0075,
  HIGH: 0.005,
  EXTREME: 0.0025,
};

export type PositionRiskPlan = {
  riskLevel: RiskLevel;
  recommendedRiskPercent: number | null;
  positionSize: number | null;
  riskAmount: number | null;
  dataQualityScore: number;
};

function atrPct(snapshot: TechnicalSnapshot): number | null {
  if (
    snapshot.atr14 === null ||
    snapshot.currentPrice === null ||
    !(snapshot.currentPrice > 0)
  ) {
    return null;
  }
  return (snapshot.atr14 / snapshot.currentPrice) * 100;
}

function stopDistancePct(entry: number | null, stop: number | null): number | null {
  if (entry === null || stop === null || !(entry > 0)) return null;
  return (Math.abs(entry - stop) / entry) * 100;
}

export function classifyRiskLevel(input: {
  asset: CatalogAsset;
  snapshot: TechnicalSnapshot;
  opportunity: Pick<
    RankedOpportunity,
    "riskReward" | "entry" | "stopLoss" | "tradeStatus" | "dataFreshness"
  >;
}): RiskLevel {
  const { asset, snapshot, opportunity } = input;

  if (
    opportunity.dataFreshness === "UNAVAILABLE" ||
    opportunity.dataFreshness === "STALE"
  ) {
    return "UNKNOWN";
  }

  let score = 0;
  if (asset.isLeveragedEtf || asset.isHighRisk) score += 3;
  if (asset.liquidityTier === "LOW") score += 2;
  else if (asset.liquidityTier === "MEDIUM") score += 1;
  if (asset.assetClass === "CRYPTO") score += 2;

  const atr = atrPct(snapshot);
  if (atr !== null) {
    if (atr >= 6) score += 3;
    else if (atr >= 4) score += 2;
    else if (atr >= 2.5) score += 1;
  }

  const stopPct = stopDistancePct(opportunity.entry, opportunity.stopLoss);
  if (stopPct !== null) {
    if (stopPct >= 8) score += 2;
    else if (stopPct >= 5) score += 1;
  }

  if (opportunity.riskReward !== null && opportunity.riskReward < 1.5) {
    score += 1;
  }

  if (snapshot.volatility === "HIGH") {
    score += 2;
  }

  if (score >= 6) return "EXTREME";
  if (score >= 4) return "HIGH";
  if (score >= 2) return "MEDIUM";
  return "LOW";
}

export function recommendedRiskPercent(riskLevel: RiskLevel): number | null {
  if (riskLevel === "UNKNOWN") return null;
  return DEFAULT_RISK_PERCENT_BY_LEVEL[riskLevel];
}

export function calculatePositionRisk(input: {
  portfolioCapital: number;
  riskLevel: RiskLevel;
  entry: number | null;
  stopLoss: number | null;
  riskPercentOverride?: number | null;
}): PositionRiskPlan {
  const dataQualityScore =
    input.entry !== null && input.stopLoss !== null ? 100 : 0;

  if (
    input.riskLevel === "UNKNOWN" ||
    input.entry === null ||
    input.stopLoss === null ||
    !(input.entry > 0) ||
    !(input.stopLoss > 0) ||
    input.entry === input.stopLoss
  ) {
    return {
      riskLevel: input.riskLevel,
      recommendedRiskPercent: recommendedRiskPercent(input.riskLevel),
      positionSize: null,
      riskAmount: null,
      dataQualityScore,
    };
  }

  const riskPercent =
    input.riskPercentOverride ?? recommendedRiskPercent(input.riskLevel);
  if (riskPercent === null || !(riskPercent > 0)) {
    return {
      riskLevel: input.riskLevel,
      recommendedRiskPercent: null,
      positionSize: null,
      riskAmount: null,
      dataQualityScore,
    };
  }

  const riskAmount = input.portfolioCapital * riskPercent;
  const stopDistance = Math.abs(input.entry - input.stopLoss);
  if (!(stopDistance > 0)) {
    return {
      riskLevel: input.riskLevel,
      recommendedRiskPercent: riskPercent,
      positionSize: null,
      riskAmount: null,
      dataQualityScore,
    };
  }

  const positionSize = riskAmount / stopDistance;
  return {
    riskLevel: input.riskLevel,
    recommendedRiskPercent: riskPercent,
    positionSize: Number.isFinite(positionSize) ? positionSize : null,
    riskAmount: Number.isFinite(riskAmount) ? riskAmount : null,
    dataQualityScore,
  };
}

export function computeDataQualityScore(input: {
  dataFreshness: RankedOpportunity["dataFreshness"];
  hasTechnicals: boolean;
  newsAvailable: boolean;
  mtfAvailable: boolean;
}): number {
  let score = 0;
  if (input.dataFreshness === "LIVE") score += 40;
  else if (input.dataFreshness === "RECENT") score += 35;
  else if (input.dataFreshness === "CACHED") score += 25;
  else if (input.dataFreshness === "STALE") score += 10;
  if (input.hasTechnicals) score += 30;
  if (input.newsAvailable) score += 15;
  if (input.mtfAvailable) score += 15;
  return Math.min(100, score);
}
