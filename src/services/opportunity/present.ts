import type { RankedOpportunity } from "./types";
import { qualityLabel } from "./ranking";

/** Stable API candidate shape for /best and board payloads. */
export function toOpportunityCandidate(item: RankedOpportunity) {
  return {
    symbol: item.symbol,
    name: item.name,
    assetType: item.assetClass,
    direction: item.direction,
    quality: item.quality,
    qualityLabel: qualityLabel(item.quality),
    tier: item.tier,
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
    news: item.newsItems.map((n) => ({
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
    scores: item.scores,
    confirmation: item.confirmation,
    reasons: item.reasons,
    risks: item.risks,
    scannedAt: item.scannedAt,
  };
}

export type OpportunityCandidate = ReturnType<typeof toOpportunityCandidate>;
