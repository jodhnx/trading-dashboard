import type { RankedOpportunity } from "./types";
import { qualityLabel } from "./ranking";
import { OPPORTUNITY_SCORE_WEIGHTS } from "./types";
import {
  deriveTradeAction,
  isActionableOpportunity,
  tradeActionLabel,
} from "./actionable";

/** Stable API candidate shape for /best and board payloads. */
export function toOpportunityCandidate(item: RankedOpportunity) {
  const confirmationLevel =
    item.quality === "STRONG" || item.quality === "CONFIRMED"
      ? item.quality
      : item.technicalConfirmation === "STRONG"
        ? "STRONG"
        : item.technicalConfirmation === "EARLY_SETUP"
          ? "EARLY_SETUP"
          : item.confirmation?.confirmation ?? item.technicalConfirmation;

  const action = deriveTradeAction(item);
  const actionable = isActionableOpportunity(item);

  return {
    symbol: item.symbol,
    name: item.name,
    assetType: item.assetClass,
    direction:
      item.tradeStatus === "NO_TRADE" && item.direction === "NO_TRADE"
        ? "NONE"
        : item.direction === "NO_TRADE"
          ? item.confirmation?.direction === "LONG" ||
            item.confirmation?.direction === "SHORT"
            ? item.confirmation.direction
            : "NONE"
          : item.direction,
    confirmation: confirmationLevel,
    tradeStatus: item.tradeStatus,
    blockReason: item.blockReason,
    technicalConfirmation: item.technicalConfirmation,
    quality: item.quality,
    qualityLabel: qualityLabel(item.quality),
    tier: item.tier,
    actionable,
    action,
    actionLabel: tradeActionLabel(action),
    opportunityScore: item.scores.opportunityScore,
    confidence: item.confidence,
    price: item.currentPrice,
    entryZone:
      item.entryZoneLow !== null || item.entryZoneHigh !== null
        ? { low: item.entryZoneLow, high: item.entryZoneHigh }
        : null,
    entry: item.entry,
    stop: item.stopLoss,
    tp1: item.takeProfit1,
    tp2: item.takeProfit2,
    riskReward: item.riskReward,
    timeHorizon: item.holdingHorizon,
    thesis: item.thesis,
    waitingFor: item.waitingFor,
    invalidation: item.invalidation,
    news: item.newsItems.slice(0, 3).map((n) => ({
      source: n.source,
      publishedAt: n.publishedAt,
      headline: n.title,
      category: n.category,
      sentiment: n.sentiment,
      impact: n.impactScore,
      relevance: n.relevance,
    })),
    dataQuality: item.dataFreshness,
    dataStatus: item.dataStatus,
    marketRegime: item.marketRegime,
    setupType: item.setupType,
    mtf: item.mtf,
    mtfScore: item.scores.multiTimeFrameScore,
    scores: {
      technicalScore: item.scores.technicalScore,
      momentumScore: item.scores.momentumScore,
      volumeScore: item.scores.volumeScore,
      newsScore: item.scores.newsScore,
      catalystScore: item.scores.catalystScore,
      sentimentScore: item.scores.sentimentScore,
      marketRegimeScore: item.scores.marketRegimeScore,
      riskRewardScore: item.scores.riskRewardScore,
      multiTimeFrameScore: item.scores.multiTimeFrameScore,
      multiTimeframeScore: item.scores.multiTimeFrameScore,
      opportunityScore: item.scores.opportunityScore,
    },
    weights: {
      technical: OPPORTUNITY_SCORE_WEIGHTS.technical,
      momentum: OPPORTUNITY_SCORE_WEIGHTS.momentum,
      news: OPPORTUNITY_SCORE_WEIGHTS.news,
      volume: OPPORTUNITY_SCORE_WEIGHTS.volume,
      catalyst: OPPORTUNITY_SCORE_WEIGHTS.catalyst,
      riskReward: OPPORTUNITY_SCORE_WEIGHTS.riskReward,
      multiTimeFrame: OPPORTUNITY_SCORE_WEIGHTS.multiTimeFrame,
      sentiment: OPPORTUNITY_SCORE_WEIGHTS.sentiment,
      marketRegime: OPPORTUNITY_SCORE_WEIGHTS.marketRegime,
    },
    confirmationDetail: item.confirmation,
    reasons: item.reasons,
    risks: item.risks,
    scannedAt: item.scannedAt,
  };
}

export type OpportunityCandidate = ReturnType<typeof toOpportunityCandidate>;
