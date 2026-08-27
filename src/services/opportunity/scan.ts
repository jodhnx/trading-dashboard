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
import { ProviderRateLimiter } from "@/services/market/rate-limit";
import { loadScanUniverse, catalogSize } from "./universe";
import {
  runBroadScreen,
  selectDeepAnalysisTargets,
  DEFAULT_BROAD_SCREEN_LIMIT,
} from "@/services/universe/broad-screen";
import type { CatalogAsset } from "@/services/universe/types";
import type { BroadScreenResult } from "@/services/universe/types";
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
  buildSignalAssetDiagnostic,
  buildSignalDiagnosticsReport,
  type SignalAssetDiagnostic,
} from "./signal-diagnostics";
import {
  freshnessConfidenceFactor,
  toDataFreshness,
} from "./quality";
import { evaluateTradeEligibility } from "./trade-status";
import {
  emptyMtfAlignment,
  loadOptionalMtfSnapshots,
  MTF_ENRICH_LIMIT,
  calculateMultiTimeframeScore,
} from "./mtf";
import {
  compareOpportunityRank,
  partitionByQuality,
  selectBestOpportunity,
  whyNoBest,
} from "./ranking";
import { buildThesis } from "./thesis";
import { deriveBoardQuality } from "./board-quality";
import {
  classifyRiskLevel,
  calculatePositionRisk,
  computeDataQualityScore,
} from "./risk";
import {
  deriveDiscoveryTags,
  isDiscoveredCandidate,
  FAMOUS_SYMBOLS,
} from "./discovery";
import {
  TOP_CRYPTO_LIMIT,
  TOP_STOCK_LIMIT,
  TOP_ETF_LIMIT,
  DISCOVERED_LIMIT,
  SPECULATIVE_LIMIT,
  SCHEDULER_NOTE,
  type FreshnessCounts,
  type MarketRegime,
  type MtfAlignment,
  type OpportunityCandidateDiagnostic,
  type OpportunityScanSummary,
  type RankedOpportunity,
  type ScanBoardState,
  type SignalQuality,
} from "./types";

function isTradeableClass(assetClass: string): boolean {
  return assetClass === "STOCK" || assetClass === "ETF" || assetClass === "CRYPTO";
}

function deriveBoardState(input: {
  liveOrCached: number;
  confirmedOrStrong: number;
  earlyOrWatch: number;
}): ScanBoardState {
  if (input.liveOrCached === 0) {
    return "DATA_INSUFFICIENT";
  }
  if (input.confirmedOrStrong > 0) {
    return "OPPORTUNITIES_AVAILABLE";
  }
  if (input.earlyOrWatch > 0) {
    return "WATCH_ONLY";
  }
  return "NO_TRADE";
}

function dataSkipDiagnostic(input: {
  symbol: string;
  assetType: string;
  quoteStatus: string;
  technicalStatus: string;
  reason: string;
}): OpportunityCandidateDiagnostic {
  return {
    symbol: input.symbol,
    assetType: input.assetType,
    quoteStatus: input.quoteStatus,
    technicalStatus: input.technicalStatus,
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
    multiTimeFrameScore: 0,
    multiTimeframeScore: 0,
    finalOpportunityScore: 0,
    tier: "DATA_SKIP",
    quality: "DATA_SKIP",
    rejectionReason: input.reason,
  };
}

type DraftCandidate = {
  asset: CatalogAsset;
  setup: TradingSetup;
  technicalBreakdown: ReturnType<typeof scoreSetup>;
  snapshot: TechnicalSnapshot;
  newsImpact: ReturnType<typeof scoreNewsForSymbol>;
  quoteStatus: string;
  mtf: MtfAlignment;
  screen: BroadScreenResult | null;
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
      (d) => d.quality === "STRONG" || d.quality === "CONFIRMED",
    ).length,
    early: diagnostics.filter((d) => d.quality === "EARLY_SETUP").length,
    watch: diagnostics.filter((d) => d.quality === "WATCH").length,
    dataSkip: diagnostics.filter((d) => d.tier === "DATA_SKIP").length,
    sample: interesting.slice(0, 12).map((d) => ({
      symbol: d.symbol,
      quoteStatus: d.quoteStatus,
      technicalStatus: d.technicalStatus,
      engineDirection: d.engineDirection,
      engineStatus: d.engineStatus,
      finalOpportunityScore: d.finalOpportunityScore,
      quality: d.quality,
      tier: d.tier,
      rejectionReason: d.rejectionReason,
    })),
  });
}

function buildFreshnessCounts(
  diagnostics: OpportunityCandidateDiagnostic[],
): FreshnessCounts {
  const skipReasons: Record<string, number> = {};
  let liveCount = 0;
  let recentCount = 0;
  let cachedCount = 0;
  let staleCount = 0;
  let unavailableCount = 0;
  let dataSkippedCount = 0;

  for (const d of diagnostics) {
    if (d.tier === "DATA_SKIP") {
      dataSkippedCount += 1;
      const reason = d.rejectionReason ?? "unknown";
      skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
      unavailableCount += 1;
      continue;
    }
    const freshness = toDataFreshness(d.technicalStatus);
    if (freshness === "LIVE") liveCount += 1;
    else if (freshness === "RECENT") recentCount += 1;
    else if (freshness === "CACHED") cachedCount += 1;
    else if (freshness === "STALE") staleCount += 1;
    else unavailableCount += 1;
  }

  return {
    liveCount,
    recentCount,
    cachedCount,
    staleCount,
    unavailableCount,
    dataSkippedCount,
    skipReasons,
  };
}

function syncTierWithQuality(
  quality: SignalQuality,
  classifiedTier: RankedOpportunity["tier"],
  opportunityScore: number,
  tradeStatus: RankedOpportunity["tradeStatus"],
): RankedOpportunity["tier"] {
  // BLOCKED strong setups must remain visible on the board (not silently dropped).
  if (tradeStatus === "BLOCKED") {
    return "WATCH";
  }
  if (quality === "STRONG") {
    return opportunityScore >= 80 ? "STRONG_OPPORTUNITY" : "OPPORTUNITY";
  }
  if (quality === "CONFIRMED") {
    return opportunityScore >= 80 ? "STRONG_OPPORTUNITY" : "OPPORTUNITY";
  }
  if (quality === "EARLY_SETUP" || quality === "WATCH") {
    return "WATCH";
  }
  if (quality === "DATA_INSUFFICIENT") {
    return classifiedTier;
  }
  return "NO_TRADE";
}

function finalizeCandidate(input: {
  draft: DraftCandidate;
  marketRegime: MarketRegime;
  newsUnavailable: boolean;
  scannedAt: string;
  nowMs: number;
  portfolioCapital: number;
}): RankedOpportunity {
  const { draft } = input;
  const dataFreshness = toDataFreshness(
    draft.snapshot.dataStatus,
    draft.snapshot.asOf
      ? new Date(draft.snapshot.asOf).getTime()
      : null,
    input.nowMs,
  );
  const scores = computeOpportunityScore({
    technicalBreakdown: draft.technicalBreakdown,
    setup: draft.setup,
    newsScore: draft.newsImpact.newsScore,
    catalystScore: draft.newsImpact.catalystScore,
    sentimentScore: draft.newsImpact.sentimentScore,
    marketRegime: input.marketRegime,
    multiTimeFrameScore: draft.mtf.score,
    freshnessFactor: freshnessConfidenceFactor(dataFreshness),
  });
  const classified = classifyOpportunityTier({
    setup: draft.setup,
    opportunityScore: scores.opportunityScore,
    dataStatus: draft.snapshot.dataStatus,
    hasTechnicals: snapshotHasTechnicals(draft.snapshot),
  });
  const eligibility = evaluateTradeEligibility({
    setup: draft.setup,
    snapshot: draft.snapshot,
    dataFreshness,
  });
  const quality = eligibility.quality;
  const tier = syncTierWithQuality(
    quality,
    classified.tier,
    scores.opportunityScore,
    eligibility.tradeStatus,
  );
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
  const thesis = buildThesis({
    setup: draft.setup,
    snapshot: draft.snapshot,
    quality,
    newsItems: draft.newsImpact.newsItems,
    mtf: draft.mtf,
  });

  const risks: string[] = [...draft.setup.rejectReasons];
  if (draft.snapshot.dataStatus === "STALE") {
    risks.push("STALE market data");
  }
  if (dataFreshness === "CACHED" || dataFreshness === "RECENT") {
    risks.push(`${dataFreshness} data — not LIVE`);
  }
  if (input.newsUnavailable) {
    risks.push("NEWS UNAVAILABLE — news score is neutral baseline");
  }
  if (quality === "EARLY_SETUP") {
    risks.push("DEVELOPING SETUP — not a buy/sell instruction");
  }
  if (eligibility.tradeStatus === "BLOCKED" && eligibility.blockReason) {
    risks.push(`BLOCKED: ${eligibility.blockReason}`);
  }
  if (draft.setup.direction === "NO_TRADE" && tier === "WATCH") {
    risks.push("Waiting for confirmation — no forced entry levels");
  }

  const hasActionableLevels =
    eligibility.tradeStatus === "ELIGIBLE" &&
    (quality === "STRONG" || quality === "CONFIRMED") &&
    draft.setup.status === "VALID" &&
    (draft.setup.direction === "LONG" || draft.setup.direction === "SHORT");

  const confidence = Math.round(
    scores.opportunityScore * freshnessConfidenceFactor(dataFreshness),
  );

  const baseScores = {
    ...scores,
    riskScore: 50,
    dataQualityScore: 50,
  };

  const base: RankedOpportunity = {
    symbol: draft.asset.symbol,
    name: draft.asset.name,
    assetClass: draft.asset.assetClass,
    direction: draft.setup.direction,
    tier,
    quality,
    technicalConfirmation: eligibility.technicalConfirmation,
    tradeStatus: eligibility.tradeStatus,
    blockReason: eligibility.blockReason,
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
    scores: baseScores,
    marketRegime: input.marketRegime,
    dataStatus: draft.snapshot.dataStatus as RankedOpportunity["dataStatus"],
    dataFreshness,
    confidence,
    thesis,
    mtf: draft.mtf,
    reasons: [
      ...draft.setup.reasons.slice(0, 4),
      ...draft.technicalBreakdown.reasons.slice(0, 2),
      ...draft.newsImpact.headlines.slice(0, 1).map((h) => `News: ${h}`),
    ],
    risks,
    waitingFor,
    newsHeadlines: draft.newsImpact.headlines,
    newsItems: draft.newsImpact.newsItems,
    confirmation: draft.setup.confirmation
      ? {
          direction: draft.setup.confirmation.direction,
          confirmation: draft.setup.confirmation.confirmation,
          trend: draft.setup.confirmation.trend,
          momentum: draft.setup.confirmation.momentum,
          ema: draft.setup.confirmation.ema,
          macd: draft.setup.confirmation.macd,
          regime: input.marketRegime,
          atrValid: draft.setup.confirmation.atrValid,
          rrValid: draft.setup.confirmation.rrValid,
          explain: draft.setup.confirmation.explain,
        }
      : null,
    scannedAt: input.scannedAt,
    screenScore: draft.screen?.screenScore ?? null,
  };

  const riskLevel = classifyRiskLevel({
    asset: draft.asset,
    snapshot: draft.snapshot,
    opportunity: base,
  });
  const positionRisk = calculatePositionRisk({
    portfolioCapital: input.portfolioCapital,
    riskLevel,
    entry: base.entry,
    stopLoss: base.stopLoss,
  });
  const dataQualityScore = computeDataQualityScore({
    dataFreshness,
    hasTechnicals: snapshotHasTechnicals(draft.snapshot),
    newsAvailable: draft.newsImpact.newsItems.length > 0,
    mtfAvailable: draft.mtf.setup.available || draft.mtf.entry.available,
  });
  const boardQuality = deriveBoardQuality(base, riskLevel);
  const discoveryTags = deriveDiscoveryTags({
    screen: draft.screen,
    snapshot: draft.snapshot,
    opportunity: base,
  });

  const riskPenalty =
    riskLevel === "EXTREME" ? 40 : riskLevel === "HIGH" ? 25 : riskLevel === "MEDIUM" ? 12 : 0;

  return {
    ...base,
    boardQuality,
    riskLevel,
    recommendedRiskPercent: positionRisk.recommendedRiskPercent,
    discoveryTags,
    positionSize:
      hasActionableLevels && base.positionSize !== null
        ? base.positionSize
        : positionRisk.positionSize,
    riskAmount:
      hasActionableLevels && base.riskAmount !== null
        ? base.riskAmount
        : positionRisk.riskAmount,
    scores: {
      ...baseScores,
      riskScore: Math.max(0, 100 - riskPenalty),
      dataQualityScore,
    },
  };
}

export async function scanDailyOpportunities(input: {
  userId: string;
  email: string | null;
  now?: Date;
  persistence?: "session" | "admin";
  /** Test / override hook — defaults to broad catalog slice. */
  scanUniverse?: CatalogAsset[];
}): Promise<OpportunityScanSummary> {
  const now = input.now ?? new Date();
  const scannedAt = now.toISOString();
  const nowMs = now.getTime();
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
    const news = await createNewsService().listNews({ limit: 150 });
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
  const newsUnavailable = newsItems.length === 0;

  const diagnostics: OpportunityCandidateDiagnostic[] = [];
  const signalAssets: SignalAssetDiagnostic[] = [];
  let unavailable = 0;

  const universe =
    input.scanUniverse ?? loadScanUniverse({ limit: DEFAULT_BROAD_SCREEN_LIMIT });
  const limiter = new ProviderRateLimiter();

  const broad = await runBroadScreen({
    assets: universe,
    market,
    limiter,
    maxSymbols: DEFAULT_BROAD_SCREEN_LIMIT,
  });

  for (const row of broad.skipped) {
    unavailable += 1;
    diagnostics.push(
      dataSkipDiagnostic({
        symbol: row.symbol,
        assetType: row.asset.assetClass,
        quoteStatus: row.quoteStatus,
        technicalStatus: "UNAVAILABLE",
        reason: row.skipReason ?? "data_unavailable",
      }),
    );
  }

  const deepTargets = selectDeepAnalysisTargets(broad.screened);
  let providerRateLimited = limiter.state.tripped || !limiter.canCall();

  const technicalPool: Array<{
    symbol: string;
    trend: string;
    volatility: string;
    dataStatus: string;
  }> = broad.screened.map((s) => ({
    symbol: s.symbol,
    trend: "UNKNOWN",
    volatility: "UNKNOWN",
    dataStatus: s.quoteStatus,
  }));

  const drafts: DraftCandidate[] = [];
  let available = 0;
  let liveOrCached = 0;

  for (const screen of deepTargets) {
    const asset = screen.asset;

    if (!limiter.canCall()) {
      unavailable += 1;
      providerRateLimited = true;
      diagnostics.push(
        dataSkipDiagnostic({
          symbol: asset.symbol,
          assetType: asset.assetClass,
          quoteStatus: screen.quoteStatus,
          technicalStatus: "UNAVAILABLE",
          reason: limiter.state.tripped
            ? "provider_rate_limit"
            : "provider_call_budget_exceeded",
        }),
      );
      continue;
    }

    const quoteStatus = screen.quoteStatus;
    try {
      await limiter.beforeCall();
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
        diagnostics.push(
          dataSkipDiagnostic({
            symbol: asset.symbol,
            assetType: asset.assetClass,
            quoteStatus,
            technicalStatus: technical.snapshot.dataStatus,
            reason:
              technical.snapshot.dataStatus === "MOCK"
                ? "data_mock"
                : "data_unavailable",
          }),
        );
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
        mtf: emptyMtfAlignment(technical.snapshot),
        screen,
      });
    } catch (error) {
      limiter.onError(error);
      providerRateLimited = limiter.state.tripped || !limiter.canCall();
      unavailable += 1;
      const reason =
        error instanceof DataUnavailableError
          ? error.details?.reason === "rate_limit"
            ? "provider_rate_limit"
            : `provider_${String(error.details?.reason ?? "error")}`
          : "provider_error";
      diagnostics.push(
        dataSkipDiagnostic({
          symbol: asset.symbol,
          assetType: asset.assetClass,
          quoteStatus,
          technicalStatus: "UNAVAILABLE",
          reason,
        }),
      );
    }
  }

  const skipReasons: Record<string, number> = {};
  for (const row of broad.skipped) {
    const r = row.skipReason ?? "unknown";
    skipReasons[r] = (skipReasons[r] ?? 0) + 1;
  }
  const stageStats = {
    universeSize: catalogSize(),
    broadScreenRequested: universe.length,
    broadScreened: broad.screened.length,
    broadSkipped: broad.skipped.length,
    deepAnalyzed: deepTargets.length,
    deepSkipped: deepTargets.length - drafts.length,
    providerCalls: limiter.state.calls,
    rateLimitTrips: limiter.state.tripped ? 1 : 0,
    skipReasons,
  };

  const marketRegime: MarketRegime = detectMarketRegime(technicalPool);

  // Preliminary finalize to pick MTF enrichment targets (rate-limit safe)
  let preliminary = drafts.map((draft) =>
    finalizeCandidate({
      draft,
      marketRegime,
      newsUnavailable,
      scannedAt,
      nowMs,
      portfolioCapital: risk.accountCapital,
    }),
  );
  const enrichTargets = [...preliminary]
    .sort(compareOpportunityRank)
    .filter(
      (item) =>
        item.quality === "STRONG" ||
        item.quality === "CONFIRMED" ||
        item.quality === "EARLY_SETUP" ||
        item.quality === "WATCH",
    )
    .slice(0, MTF_ENRICH_LIMIT)
    .map((item) => item.symbol);

  if (!providerRateLimited && enrichTargets.length > 0) {
    for (const symbol of enrichTargets) {
      const draft = drafts.find((d) => d.asset.symbol === symbol);
      if (!draft) continue;
      providerRateLimited = limiter.state.tripped || !limiter.canCall();
      if (providerRateLimited) break;
      const mtfResult = await loadOptionalMtfSnapshots({
        market,
        symbol,
        limiter,
      });
      if (mtfResult.rateLimited) {
        providerRateLimited = true;
      }
      const scored = calculateMultiTimeframeScore({
        daily: draft.snapshot,
        setup: mtfResult.setup,
        entry: mtfResult.entry,
      });
      draft.mtf = scored.alignment;
      if (providerRateLimited) break;
    }
    preliminary = drafts.map((draft) =>
      finalizeCandidate({
        draft,
        marketRegime,
        newsUnavailable,
        scannedAt,
        nowMs,
        portfolioCapital: risk.accountCapital,
      }),
    );
  }

  const finalized = preliminary;

  // Replace diagnostics for evaluated drafts (skip rows already recorded)
  for (const item of finalized) {
    const draft = drafts.find((d) => d.asset.symbol === item.symbol)!;
    diagnostics.push({
      symbol: item.symbol,
      assetType: item.assetClass,
      quoteStatus: draft.quoteStatus,
      technicalStatus: item.dataStatus,
      engineStatus: draft.setup.status,
      engineDirection: draft.setup.direction,
      engineScore: draft.setup.score,
      technicalScore: item.scores.technicalScore,
      momentumScore: item.scores.momentumScore,
      volumeScore: item.scores.volumeScore,
      newsScore: item.scores.newsScore,
      catalystScore: item.scores.catalystScore,
      sentimentScore: item.scores.sentimentScore,
      regimeScore: item.scores.marketRegimeScore,
      riskRewardScore: item.scores.riskRewardScore,
      multiTimeFrameScore: item.scores.multiTimeFrameScore,
      multiTimeframeScore: item.scores.multiTimeFrameScore,
      finalOpportunityScore: item.scores.opportunityScore,
      tier: item.tier,
      quality: item.quality,
      tradeStatus: item.tradeStatus,
      blockReason: item.blockReason,
      technicalConfirmation: item.technicalConfirmation,
      rejectionReason: item.blockReason,
    });
    signalAssets.push(
      buildSignalAssetDiagnostic({
        symbol: item.symbol,
        assetType: item.assetClass,
        quoteStatus: draft.quoteStatus,
        snapshot: draft.snapshot,
        setup: draft.setup,
        opportunityScore: item.scores.opportunityScore,
        tier: item.tier,
        rejectionReason: null,
      }),
    );
  }

  logSafeDiagnostics(diagnostics);

  const stocks = finalized.filter((item) => item.assetClass === "STOCK");
  const cryptos = finalized.filter((item) => item.assetClass === "CRYPTO");
  const bestStock = selectBestOpportunity(stocks);
  const bestCrypto = selectBestOpportunity(cryptos);
  const partitioned = partitionByQuality(finalized);

  const rankedBoard = finalized
    .filter(
      (item) =>
        item.boardQuality !== "NO_TRADE" &&
        item.boardQuality !== "DATA_SKIP" &&
        (item.quality === "STRONG" ||
          item.quality === "CONFIRMED" ||
          item.quality === "EARLY_SETUP" ||
          item.quality === "WATCH"),
    )
    .sort(compareOpportunityRank);

  const topStocks = rankedBoard
    .filter((item) => item.assetClass === "STOCK")
    .slice(0, TOP_STOCK_LIMIT);
  const topCrypto = rankedBoard
    .filter((item) => item.assetClass === "CRYPTO")
    .slice(0, TOP_CRYPTO_LIMIT);
  const topEtfs = rankedBoard
    .filter((item) => item.assetClass === "ETF")
    .slice(0, TOP_ETF_LIMIT);

  const discovered = rankedBoard
    .filter((item) =>
      isDiscoveredCandidate({
        tags: (item.discoveryTags ?? []) as import("./discovery").DiscoveryTag[],
        screenScore: item.screenScore ?? 0,
        opportunityScore: item.scores.opportunityScore,
        symbol: item.symbol,
        famousSymbols: FAMOUS_SYMBOLS,
      }),
    )
    .slice(0, DISCOVERED_LIMIT);

  const speculative = finalized
    .filter((item) => item.boardQuality === "SPECULATIVE")
    .sort(compareOpportunityRank)
    .slice(0, SPECULATIVE_LIMIT);

  const strong = finalized.filter((i) => i.quality === "STRONG").length;
  const confirmed = finalized.filter((i) => i.quality === "CONFIRMED").length;
  const earlySetup = partitioned.developing.length;
  const watch = partitioned.watch.length;
  const opportunities = confirmed; // legacy field: confirmed count
  const boardState = deriveBoardState({
    liveOrCached,
    confirmedOrStrong: strong + confirmed,
    earlyOrWatch: earlySetup + watch + partitioned.blocked.length,
  });

  const noTrade = finalized.filter(
    (i) =>
      i.quality === "NO_TRADE" &&
      !isDataQualityRejection(
        diagnostics.find((d) => d.symbol === i.symbol)?.rejectionReason ?? null,
      ),
  ).length;

  const signalReport = buildSignalDiagnosticsReport({
    boardState,
    diagnostics: signalAssets,
    candidateDiagnostics: diagnostics,
    dataSkipped: diagnostics.filter((d) => d.tier === "DATA_SKIP").length,
  });

  const freshness = buildFreshnessCounts(diagnostics);

  console.info("[opportunity-scan] phase25 broad scan", {
    boardState,
    universeSize: stageStats.universeSize,
    broadScreened: stageStats.broadScreened,
    deepAnalyzed: stageStats.deepAnalyzed,
    providerCalls: stageStats.providerCalls,
    bestStock: bestStock?.symbol ?? null,
    bestCrypto: bestCrypto?.symbol ?? null,
    discovered: discovered.length,
    speculative: speculative.length,
  });

  return {
    scanned: universe.filter((a) => a.tradable).length,
    available,
    unavailable,
    liveOrCached,
    strong,
    opportunities,
    confirmed,
    earlySetup,
    watch,
    noTrade,
    bestStock,
    bestCrypto,
    topStocks,
    topCrypto,
    topEtfs,
    discovered,
    speculative,
    developing: partitioned.developing,
    blocked: partitioned.blocked,
    watchList: partitioned.watch,
    all: [...finalized].sort(compareOpportunityRank),
    marketRegime,
    noHighConfidence: bestStock === null && bestCrypto === null,
    whyNoBestStock:
      bestStock === null
        ? whyNoBest({
            assetClass: "STOCK",
            candidates: stocks,
            liveOrCached: stocks.filter(
              (s) => s.dataStatus === "LIVE" || s.dataStatus === "CACHED",
            ).length,
          })
        : null,
    whyNoBestCrypto:
      bestCrypto === null
        ? whyNoBest({
            assetClass: "CRYPTO",
            candidates: cryptos,
            liveOrCached: cryptos.filter(
              (s) => s.dataStatus === "LIVE" || s.dataStatus === "CACHED",
            ).length,
          })
        : null,
    boardState,
    freshness,
    diagnostics,
    signalReport,
    schedulerNote: SCHEDULER_NOTE,
    stageStats,
  };
}
