import "server-only";

import { createMarketDataService } from "@/services/market/create-service";
import { createNewsService } from "@/services/news/create-service";
import { getOrCreateAccountSettings } from "@/lib/settings/service";
import { toTradingRiskSettings } from "@/lib/settings/schema";
import { buildTradingSetup } from "@/engine/trading/setup";
import { scoreSetup } from "@/engine/trading/score";
import type { TradingSetup } from "@/engine/trading/types";
import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import { DAILY_BRIEF_TIMEFRAME } from "@/services/daily-brief/types";
import { OPPORTUNITY_UNIVERSE } from "./universe";
import { detectMarketRegime } from "./regime";
import { scoreNewsForSymbol } from "./news-impact";
import {
  classifyOpportunityTier,
  classifySetupType,
  computeOpportunityScore,
  snapshotHasTechnicals,
} from "./score";
import { deriveEntryPlan } from "./entry";
import {
  TOP_CRYPTO_LIMIT,
  TOP_STOCK_LIMIT,
  type MarketRegime,
  type OpportunityCandidateDiagnostic,
  type OpportunityScanSummary,
  type RankedOpportunity,
  type ScanBoardState,
} from "./types";

function isTradeableClass(assetClass: string): boolean {
  return assetClass === "STOCK" || assetClass === "ETF" || assetClass === "CRYPTO";
}

function deriveBoardState(input: {
  liveOrCached: number;
  strong: number;
  opportunities: number;
  watch: number;
}): ScanBoardState {
  if (input.liveOrCached === 0) {
    return "DATA_INSUFFICIENT";
  }
  if (input.strong + input.opportunities > 0) {
    return "OPPORTUNITIES_AVAILABLE";
  }
  if (input.watch > 0) {
    return "WATCH_ONLY";
  }
  return "NO_TRADE";
}

type DraftCandidate = {
  asset: (typeof OPPORTUNITY_UNIVERSE)[number];
  setup: TradingSetup;
  technicalBreakdown: ReturnType<typeof scoreSetup>;
  snapshot: TechnicalSnapshot;
  newsImpact: ReturnType<typeof scoreNewsForSymbol>;
};

function logSafeDiagnostics(diagnostics: OpportunityCandidateDiagnostic[]): void {
  const interesting = diagnostics.filter(
    (item) =>
      item.dataStatus === "LIVE" ||
      item.dataStatus === "CACHED" ||
      item.dataStatus === "STALE",
  );
  console.info("[opportunity-scan] candidate summary", {
    counted: diagnostics.length,
    liveOrCached: diagnostics.filter(
      (d) => d.dataStatus === "LIVE" || d.dataStatus === "CACHED",
    ).length,
    actionable: diagnostics.filter(
      (d) => d.tier === "STRONG_OPPORTUNITY" || d.tier === "OPPORTUNITY",
    ).length,
    watch: diagnostics.filter((d) => d.tier === "WATCH").length,
    sample: interesting.slice(0, 8).map((d) => ({
      symbol: d.symbol,
      dataStatus: d.dataStatus,
      setupDirection: d.setupDirection,
      setupStatus: d.setupStatus,
      finalScore: d.finalScore,
      tier: d.tier,
      rejectionReason: d.rejectionReason,
    })),
  });
}

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
  let liveOrCached = 0;

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
      if (
        technical.snapshot.dataStatus === "LIVE" ||
        technical.snapshot.dataStatus === "CACHED"
      ) {
        liveOrCached += 1;
      }

      if (!isTradeableClass(asset.assetClass)) {
        continue;
      }

      const setup = buildTradingSetup({
        snapshot: technical.snapshot,
        settings: risk,
        now,
      });
      // Best directional technical score even when engine says NO_TRADE
      const scoreLong = scoreSetup(technical.snapshot, "LONG");
      const scoreShort = scoreSetup(technical.snapshot, "SHORT");
      const technicalBreakdown =
        setup.direction === "SHORT"
          ? scoreShort
          : setup.direction === "LONG"
            ? scoreLong
            : scoreLong.total >= scoreShort.total
              ? scoreLong
              : scoreShort;

      const newsImpact = scoreNewsForSymbol({
        symbol: asset.symbol,
        news: newsItems,
        now,
      });

      drafts.push({
        asset,
        setup,
        technicalBreakdown,
        snapshot: technical.snapshot,
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
  const diagnostics: OpportunityCandidateDiagnostic[] = [];

  const finalized: RankedOpportunity[] = drafts.map((draft) => {
    const scores = computeOpportunityScore({
      technicalBreakdown: draft.technicalBreakdown,
      setup: draft.setup,
      newsScore: draft.newsImpact.newsScore,
      catalystScore: draft.newsImpact.catalystScore,
      sentimentScore: draft.newsImpact.sentimentScore,
      marketRegime,
    });
    const classified = classifyOpportunityTier({
      setup: draft.setup,
      opportunityScore: scores.opportunityScore,
      dataStatus: draft.snapshot.dataStatus,
      hasTechnicals: snapshotHasTechnicals(draft.snapshot),
    });
    const entryPlan = deriveEntryPlan({
      setup: draft.setup,
      atr14: draft.snapshot.atr14,
    });
    const setupType = classifySetupType({
      snapshot: draft.snapshot,
      setup: draft.setup,
      newsScore: draft.newsImpact.newsScore,
    });

    const risks: string[] = [...draft.setup.rejectReasons];
    if (draft.snapshot.dataStatus === "STALE") {
      risks.push("STALE market data");
    }
    if (newsItems.length === 0) {
      risks.push("NEWS UNAVAILABLE — news score is neutral baseline");
    }
    if (draft.setup.direction === "NO_TRADE" && classified.tier === "WATCH") {
      risks.push("Engine NO_TRADE — watch only, no forced entry levels");
    }

    diagnostics.push({
      symbol: draft.asset.symbol,
      dataStatus: draft.snapshot.dataStatus,
      setupDirection: draft.setup.direction,
      setupStatus: draft.setup.status,
      technicalScore: scores.technicalScore,
      momentumScore: scores.momentumScore,
      volumeScore: scores.volumeScore,
      newsScore: scores.newsScore,
      catalystScore: scores.catalystScore,
      sentimentScore: scores.sentimentScore,
      regimeScore: scores.marketRegimeScore,
      riskRewardScore: scores.riskRewardScore,
      finalScore: scores.opportunityScore,
      tier: classified.tier,
      rejectionReason: classified.rejectionReason,
    });

    const hasActionableLevels =
      draft.setup.status === "VALID" &&
      (draft.setup.direction === "LONG" || draft.setup.direction === "SHORT");

    return {
      symbol: draft.asset.symbol,
      name: draft.asset.name,
      assetClass: draft.asset.assetClass,
      direction: draft.setup.direction,
      tier: classified.tier,
      setupType,
      holdingHorizon: entryPlan.holdingHorizon,
      currentPrice: draft.snapshot.currentPrice,
      entry: hasActionableLevels ? draft.setup.entry : null,
      entryZoneLow: hasActionableLevels ? entryPlan.entryZoneLow : null,
      entryZoneHigh: hasActionableLevels ? entryPlan.entryZoneHigh : null,
      maxChase: hasActionableLevels ? entryPlan.maxChase : null,
      stopLoss: hasActionableLevels ? draft.setup.stopLoss : null,
      takeProfit1: hasActionableLevels ? draft.setup.takeProfit : null,
      takeProfit2: hasActionableLevels ? entryPlan.takeProfit2 : null,
      invalidation: hasActionableLevels ? entryPlan.invalidation : null,
      riskReward: hasActionableLevels ? draft.setup.riskReward : null,
      positionSize: hasActionableLevels ? draft.setup.positionSize : null,
      riskAmount: hasActionableLevels ? draft.setup.riskAmount : null,
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

  logSafeDiagnostics(diagnostics);

  const actionable = finalized
    .filter(
      (item) =>
        item.tier === "STRONG_OPPORTUNITY" || item.tier === "OPPORTUNITY",
    )
    .sort((a, b) => b.scores.opportunityScore - a.scores.opportunityScore);

  const watchList = finalized
    .filter((item) => item.tier === "WATCH")
    .sort((a, b) => b.scores.opportunityScore - a.scores.opportunityScore);

  const strong = finalized.filter((i) => i.tier === "STRONG_OPPORTUNITY").length;
  const opportunities = finalized.filter((i) => i.tier === "OPPORTUNITY").length;
  const watch = watchList.length;
  const boardState = deriveBoardState({
    liveOrCached,
    strong,
    opportunities,
    watch,
  });

  return {
    scanned: OPPORTUNITY_UNIVERSE.length,
    available,
    unavailable,
    liveOrCached,
    strong,
    opportunities,
    watch,
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
    boardState,
    diagnostics,
  };
}
