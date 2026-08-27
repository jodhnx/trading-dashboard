import type { RankedOpportunity } from "./types";
import { qualityLabel } from "./ranking";
import { OPPORTUNITY_SCORE_WEIGHTS } from "./types";
import { boardQualityLabel } from "./board-quality";
import {
  deriveTradeAction,
  isActionableOpportunity,
  tradeActionLabel,
} from "./actionable";
import {
  buildNewsPresentation,
  deriveMissingConfirmation,
  deriveWhyRanked,
} from "./table-utils";

/** Stable API candidate shape for opportunities board and table payloads. */
export function toOpportunityCandidate(item: RankedOpportunity, rank?: number) {
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
  const news = buildNewsPresentation(item);

  return {
    rank: rank ?? null,
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
    boardQuality: item.boardQuality ?? null,
    boardQualityLabel: item.boardQuality
      ? boardQualityLabel(item.boardQuality)
      : null,
    riskLevel: item.riskLevel ?? "UNKNOWN",
    recommendedRiskPercent: item.recommendedRiskPercent ?? null,
    discoveryTags: item.discoveryTags ?? [],
    screenScore: item.screenScore ?? null,
    positionSize: item.positionSize,
    actionable,
    action,
    actionLabel: tradeActionLabel(action),
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
    missingConfirmation: deriveMissingConfirmation(item),
    whyRanked: deriveWhyRanked(item),
    invalidation: item.invalidation,
    news: item.newsItems.slice(0, 5).map((n) => ({
      source: n.source,
      publishedAt: n.publishedAt,
      headline: n.title,
      category: n.category,
      sentiment: n.sentiment,
      impact: n.impactScore,
      relevance: n.relevance,
    })),
    newsSummary: {
      impactLabel: news.impactLabel,
      sentimentLabel: news.sentimentLabel,
      articleCount: news.articleCount,
      latestNewsAt: news.latestNewsAt,
      catalyst: news.catalyst,
      impactExplanation: news.impactExplanation,
      newsTechnicalNote: news.newsTechnicalNote,
      newsScore: item.scores.newsScore,
      sentimentScore: item.scores.sentimentScore,
      catalystScore: item.scores.catalystScore,
    },
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
      riskScore: item.scores.riskScore ?? 50,
      dataQualityScore: item.scores.dataQualityScore ?? 50,
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

export function toRankedCandidates(items: RankedOpportunity[]) {
  return items.map((item, index) => toOpportunityCandidate(item, index + 1));
}
