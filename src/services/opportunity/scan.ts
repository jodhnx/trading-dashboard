import "server-only";

import { createMarketDataService } from "@/services/market/create-service";
import { createNewsService } from "@/services/news/create-service";
import { getOrCreateAccountSettings } from "@/lib/settings/service";
import { toTradingRiskSettings } from "@/lib/settings/schema";
import { buildTradingSetup } from "@/engine/trading/setup";
import { scoreSetup } from "@/engine/trading/score";
import type { TradingSetup } from "@/engine/trading/types";
import { DAILY_BRIEF_TIMEFRAME } from "@/services/daily-brief/types";
import { OPPORTUNITY_UNIVERSE } from "./universe";
import { detectMarketRegime } from "./regime";
import { scoreNewsForSymbol } from "./news-impact";
import {
  classifyOpportunityTier,
  classifySetupType,
  computeOpportunityScore,
} from "./score";
import { deriveEntryPlan } from "./entry";
import {
  TOP_CRYPTO_LIMIT,
  TOP_STOCK_LIMIT,
  type MarketRegime,
  type OpportunityScanSummary,
  type RankedOpportunity,
} from "./types";

function isTradeableClass(assetClass: string): boolean {
  return assetClass === "STOCK" || assetClass === "ETF" || assetClass === "CRYPTO";
}

type DraftCandidate = {
  asset: (typeof OPPORTUNITY_UNIVERSE)[number];
  setup: TradingSetup;
  technicalBreakdown: ReturnType<typeof scoreSetup>;
  snapshot: {
    currentPrice: number | null;
    atr14: number | null;
    dataStatus: string;
  };
  newsImpact: ReturnType<typeof scoreNewsForSymbol>;
};

export async function scanDailyOpportunities(input: {
  userId: string;
  email: string | null;
  now?: Date;
  persistence?: "session" | "admin";
}): Promise<OpportunityScanSummary> {
  const now = input.now ?? new Date();
  const scannedAt = now.toISOString();
  const settings = await getOrCreateAccountSettings(input.userId, input.email, {
    persistence: input.persistence,
  });
  const risk = toTradingRiskSettings(settings);
  const market = createMarketDataService();

  let newsItems: Array<{
    id: string;
    title: string;
    category: string;
    relevance: string;
    sentiment: string;
    publishedAt: Date;
    assetSymbols: string[];
  }> = [];
  try {
    const news = await createNewsService().listNews({ limit: 40 });
    newsItems = news.items.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      relevance: item.relevance,
      sentiment: item.sentiment,
      publishedAt: item.publishedAt,
      assetSymbols: item.assetSymbols,
    }));
  } catch {
    newsItems = [];
  }

  const technicalPool: Array<{
    symbol: string;
    trend: string;
    volatility: string;
    dataStatus: string;
  }> = [];
  const drafts: DraftCandidate[] = [];
  let available = 0;
  let unavailable = 0;

  for (const asset of OPPORTUNITY_UNIVERSE) {
    try {
      const technical = await market.getTechnicalSnapshot(
        asset.symbol,
        DAILY_BRIEF_TIMEFRAME,
      );
      technicalPool.push({
        symbol: asset.symbol,
        trend: technical.snapshot.trend,
        volatility: technical.snapshot.volatility,
        dataStatus: technical.snapshot.dataStatus,
      });

      if (
        technical.snapshot.dataStatus === "UNAVAILABLE" ||
        technical.snapshot.dataStatus === "MOCK"
      ) {
        unavailable += 1;
        continue;
      }
      available += 1;

      if (!isTradeableClass(asset.assetClass)) {
        continue;
      }

      const setup = buildTradingSetup({
        snapshot: technical.snapshot,
        settings: risk,
        now,
      });
      const technicalBreakdown = scoreSetup(technical.snapshot, setup.direction);
      const newsImpact = scoreNewsForSymbol({
        symbol: asset.symbol,
        news: newsItems,
        now,
      });

      drafts.push({
        asset,
        setup,
        technicalBreakdown,
        snapshot: {
          currentPrice: technical.snapshot.currentPrice,
          atr14: technical.snapshot.atr14,
          dataStatus: technical.snapshot.dataStatus,
        },
        newsImpact,
      });
    } catch {
      unavailable += 1;
      technicalPool.push({
        symbol: asset.symbol,
        trend: "UNKNOWN",
        volatility: "UNKNOWN",
        dataStatus: "UNAVAILABLE",
      });
    }
  }

  const marketRegime: MarketRegime = detectMarketRegime(technicalPool);

  const finalized: RankedOpportunity[] = drafts.map((draft) => {
    const scores = computeOpportunityScore({
      technicalBreakdown: draft.technicalBreakdown,
      setup: draft.setup,
      newsScore: draft.newsImpact.newsScore,
      catalystScore: draft.newsImpact.catalystScore,
      sentimentScore: draft.newsImpact.sentimentScore,
      marketRegime,
    });
    const tier = classifyOpportunityTier({
      setup: draft.setup,
      opportunityScore: scores.opportunityScore,
      dataStatus: draft.snapshot.dataStatus,
    });
    const entryPlan = deriveEntryPlan({
      setup: draft.setup,
      atr14: draft.snapshot.atr14,
    });
    const setupType = classifySetupType({
      snapshot: {
        momentum: "NEUTRAL",
        trend: "NEUTRAL",
        technicalCondition: "NEUTRAL",
      } as never,
      setup: draft.setup,
      newsScore: draft.newsImpact.newsScore,
    });

    // Prefer engine-derived setup type using real technical breakdown cues
    const refinedSetupType =
      draft.newsImpact.newsScore >= 75
        ? "CATALYST"
        : draft.technicalBreakdown.momentum >= 80
          ? "MOMENTUM"
          : draft.setup.direction === "NO_TRADE"
            ? "NO_SETUP"
            : draft.technicalBreakdown.trend >= 100
              ? "TREND_CONTINUATION"
              : "PULLBACK";

    const risks: string[] = [...draft.setup.rejectReasons];
    if (draft.snapshot.dataStatus === "STALE") {
      risks.push("STALE market data");
    }
    if (newsItems.length === 0) {
      risks.push("NEWS UNAVAILABLE — news score is neutral baseline");
    }

    return {
      symbol: draft.asset.symbol,
      name: draft.asset.name,
      assetClass: draft.asset.assetClass,
      direction: draft.setup.direction,
      tier,
      setupType: refinedSetupType === setupType ? setupType : refinedSetupType,
      holdingHorizon: entryPlan.holdingHorizon,
      currentPrice: draft.snapshot.currentPrice,
      entry: draft.setup.entry,
      entryZoneLow: entryPlan.entryZoneLow,
      entryZoneHigh: entryPlan.entryZoneHigh,
      maxChase: entryPlan.maxChase,
      stopLoss: draft.setup.stopLoss,
      takeProfit1: draft.setup.takeProfit,
      takeProfit2: entryPlan.takeProfit2,
      invalidation: entryPlan.invalidation,
      riskReward: draft.setup.riskReward,
      positionSize: draft.setup.positionSize,
      riskAmount: draft.setup.riskAmount,
      scores,
      marketRegime,
      dataStatus: draft.snapshot.dataStatus as RankedOpportunity["dataStatus"],
      reasons: [
        ...draft.setup.reasons.slice(0, 4),
        ...draft.technicalBreakdown.reasons.slice(0, 2),
        ...draft.newsImpact.headlines.slice(0, 1).map((h) => `News: ${h}`),
      ],
      risks,
      newsHeadlines: draft.newsImpact.headlines,
      scannedAt,
    };
  });

  const actionable = finalized
    .filter(
      (item) =>
        item.tier === "STRONG_OPPORTUNITY" || item.tier === "OPPORTUNITY",
    )
    .sort((a, b) => b.scores.opportunityScore - a.scores.opportunityScore);

  return {
    scanned: OPPORTUNITY_UNIVERSE.length,
    available,
    unavailable,
    strong: finalized.filter((i) => i.tier === "STRONG_OPPORTUNITY").length,
    opportunities: finalized.filter((i) => i.tier === "OPPORTUNITY").length,
    watch: finalized.filter((i) => i.tier === "WATCH").length,
    noTrade: finalized.filter((i) => i.tier === "NO_TRADE").length,
    topStocks: actionable
      .filter((item) => item.assetClass !== "CRYPTO")
      .slice(0, TOP_STOCK_LIMIT),
    topCrypto: actionable
      .filter((item) => item.assetClass === "CRYPTO")
      .slice(0, TOP_CRYPTO_LIMIT),
    all: finalized.sort(
      (a, b) => b.scores.opportunityScore - a.scores.opportunityScore,
    ),
    marketRegime,
    noHighConfidence: actionable.length === 0,
  };
}
