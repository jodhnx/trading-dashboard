import "server-only";

import { createMarketDataService } from "@/services/market/create-service";
import { createNewsService } from "@/services/news/create-service";
import { DataUnavailableError } from "@/services/market/errors";
import { getOrCreateAccountSettings } from "@/lib/settings/service";
import { toTradingRiskSettings } from "@/lib/settings/schema";
import { buildTradingSetup } from "@/engine/trading/setup";
import { scoreSetup } from "@/engine/trading/score";
import type { TradingSetup } from "@/engine/trading/types";
import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import { DAILY_BRIEF_TIMEFRAME } from "@/services/daily-brief/types";
import { toProviderSymbol } from "@/services/market/symbols";
import { OPPORTUNITY_UNIVERSE } from "./universe";
import { detectMarketRegime } from "./regime";
import { scoreNewsForSymbol } from "./news-impact";
import {
  classifyOpportunityTier,
  classifySetupType,
  computeOpportunityScore,
  describeWaitingFor,
  isDataQualityRejection,
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
  quoteStatus: string;
};

function logSafeDiagnostics(diagnostics: OpportunityCandidateDiagnostic[]): void {
  const interesting = diagnostics.filter(
    (item) =>
      item.technicalStatus === "LIVE" ||
      item.technicalStatus === "CACHED" ||
      item.technicalStatus === "STALE" ||
      item.tier === "DATA_SKIP",
  );
  console.info("[opportunity-scan] candidate summary", {
    counted: diagnostics.length,
    liveOrCached: diagnostics.filter(
      (d) => d.technicalStatus === "LIVE" || d.technicalStatus === "CACHED",
    ).length,
    actionable: diagnostics.filter(
      (d) => d.tier === "STRONG_OPPORTUNITY" || d.tier === "OPPORTUNITY",
    ).length,
    watch: diagnostics.filter((d) => d.tier === "WATCH").length,
    dataSkip: diagnostics.filter((d) => d.tier === "DATA_SKIP").length,
    sample: interesting.slice(0, 12).map((d) => ({
      symbol: d.symbol,
      quoteStatus: d.quoteStatus,
      technicalStatus: d.technicalStatus,
      engineDirection: d.engineDirection,
      engineStatus: d.engineStatus,
      finalOpportunityScore: d.finalOpportunityScore,
      tier: d.tier,
      rejectionReason: d.rejectionReason,
    })),
  });
}

function providerSkipReason(asset: (typeof OPPORTUNITY_UNIVERSE)[number]): string | null {
  if (asset.providerSymbol === null || toProviderSymbol(asset.symbol) === null) {
    return "provider_unmapped";
  }
  return null;
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
    sourceName: string | null;
  }> = [];
  try {
    const news = await createNewsService().listNews({ limit: 60 });
    newsItems = news.items.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      relevance: item.relevance,
      sentiment: item.sentiment,
      publishedAt: item.publishedAt,
      assetSymbols: item.assetSymbols,
      sourceName: item.sourceName ?? null,
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
  const diagnostics: OpportunityCandidateDiagnostic[] = [];
  let available = 0;
  let unavailable = 0;
  let liveOrCached = 0;

  for (const asset of OPPORTUNITY_UNIVERSE) {
    const unmapped = providerSkipReason(asset);
    if (unmapped) {
      unavailable += 1;
      diagnostics.push({
        symbol: asset.symbol,
        assetType: asset.assetClass,
        quoteStatus: "UNAVAILABLE",
        technicalStatus: "UNAVAILABLE",
        engineStatus: "SKIPPED",
        engineDirection: "NO_TRADE",
        engineScore: null,
        technicalScore: 0,
        momentumScore: 0,
        volumeScore: 0,
        newsScore: 0,
        catalystScore: 0,
        sentimentScore: 0,
        regimeScore: 0,
        riskRewardScore: 0,
        finalOpportunityScore: 0,
        tier: "DATA_SKIP",
        rejectionReason: unmapped,
      });
      technicalPool.push({
        symbol: asset.symbol,
        trend: "UNKNOWN",
        volatility: "UNKNOWN",
        dataStatus: "UNAVAILABLE",
      });
      continue;
    }

    let quoteStatus = "UNAVAILABLE";
    try {
      const quote = await market.getQuote(asset.symbol);
      quoteStatus = quote.status;
    } catch (error) {
      if (
        error instanceof DataUnavailableError &&
        error.details?.reason === "rate_limit"
      ) {
        quoteStatus = "UNAVAILABLE";
      }
    }

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
        diagnostics.push({
          symbol: asset.symbol,
          assetType: asset.assetClass,
          quoteStatus,
          technicalStatus: technical.snapshot.dataStatus,
          engineStatus: "SKIPPED",
          engineDirection: "NO_TRADE",
          engineScore: null,
          technicalScore: 0,
          momentumScore: 0,
          volumeScore: 0,
          newsScore: 0,
          catalystScore: 0,
          sentimentScore: 0,
          regimeScore: 0,
          riskRewardScore: 0,
          finalOpportunityScore: 0,
          tier: "DATA_SKIP",
          rejectionReason:
            technical.snapshot.dataStatus === "MOCK"
              ? "data_mock"
              : "data_unavailable",
        });
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
        diagnostics.push({
          symbol: asset.symbol,
          assetType: asset.assetClass,
          quoteStatus,
          technicalStatus: technical.snapshot.dataStatus,
          engineStatus: "SKIPPED",
          engineDirection: "NO_TRADE",
          engineScore: null,
          technicalScore: 0,
          momentumScore: 0,
          volumeScore: 0,
          newsScore: 0,
          catalystScore: 0,
          sentimentScore: 0,
          regimeScore: 0,
          riskRewardScore: 0,
          finalOpportunityScore: 0,
          tier: "DATA_SKIP",
          rejectionReason: "non_tradeable_asset_class",
        });
        continue;
      }

      const setup = buildTradingSetup({
        snapshot: technical.snapshot,
        settings: risk,
        now,
      });
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
        quoteStatus,
      });
    } catch (error) {
      unavailable += 1;
      const reason =
        error instanceof DataUnavailableError &&
        error.details?.reason === "rate_limit"
          ? "provider_rate_limit"
          : error instanceof DataUnavailableError
            ? `provider_${error.details?.reason ?? "error"}`
            : "provider_error";
      diagnostics.push({
        symbol: asset.symbol,
        assetType: asset.assetClass,
        quoteStatus,
        technicalStatus: "UNAVAILABLE",
        engineStatus: "SKIPPED",
        engineDirection: "NO_TRADE",
        engineScore: null,
        technicalScore: 0,
        momentumScore: 0,
        volumeScore: 0,
        newsScore: 0,
        catalystScore: 0,
        sentimentScore: 0,
        regimeScore: 0,
        riskRewardScore: 0,
        finalOpportunityScore: 0,
        tier: "DATA_SKIP",
        rejectionReason: reason,
      });
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
    const waitingFor = describeWaitingFor({
      setup: draft.setup,
      snapshot: draft.snapshot,
    });

    const risks: string[] = [...draft.setup.rejectReasons];
    if (draft.snapshot.dataStatus === "STALE") {
      risks.push("STALE market data");
    }
    if (newsItems.length === 0) {
      risks.push("NEWS UNAVAILABLE — news score is neutral baseline");
    }
    if (draft.setup.direction === "NO_TRADE" && classified.tier === "WATCH") {
      risks.push("Waiting for confirmation — no forced entry levels");
    }

    diagnostics.push({
      symbol: draft.asset.symbol,
      assetType: draft.asset.assetClass,
      quoteStatus: draft.quoteStatus,
      technicalStatus: draft.snapshot.dataStatus,
      engineStatus: draft.setup.status,
      engineDirection: draft.setup.direction,
      engineScore: draft.setup.score,
      technicalScore: scores.technicalScore,
      momentumScore: scores.momentumScore,
      volumeScore: scores.volumeScore,
      newsScore: scores.newsScore,
      catalystScore: scores.catalystScore,
      sentimentScore: scores.sentimentScore,
      regimeScore: scores.marketRegimeScore,
      riskRewardScore: scores.riskRewardScore,
      finalOpportunityScore: scores.opportunityScore,
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
      atr14: draft.snapshot.atr14,
      engineScore: draft.setup.score,
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
      waitingFor,
      newsHeadlines: draft.newsImpact.headlines,
      newsItems: draft.newsImpact.newsItems,
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

  // Provider/data failures must not inflate genuine NO_TRADE trading decisions
  const noTrade = finalized.filter(
    (i) =>
      i.tier === "NO_TRADE" &&
      !isDataQualityRejection(
        diagnostics.find((d) => d.symbol === i.symbol)?.rejectionReason ?? null,
      ),
  ).length;

  return {
    scanned: OPPORTUNITY_UNIVERSE.length,
    available,
    unavailable,
    liveOrCached,
    strong,
    opportunities,
    watch,
    noTrade,
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
