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
import { emptyTechnicalSnapshot } from "@/engine/technical/technical-snapshot";
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
import {
  TOP_CRYPTO_LIMIT,
  TOP_STOCK_LIMIT,
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
  asset: (typeof OPPORTUNITY_UNIVERSE)[number];
  setup: TradingSetup;
  technicalBreakdown: ReturnType<typeof scoreSetup>;
  snapshot: TechnicalSnapshot;
  newsImpact: ReturnType<typeof scoreNewsForSymbol>;
  quoteStatus: string;
  mtf: MtfAlignment;
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

function providerSkipReason(asset: (typeof OPPORTUNITY_UNIVERSE)[number]): string | null {
  if (asset.providerSymbol === null || toProviderSymbol(asset.symbol) === null) {
    return "provider_unmapped";
  }
  return null;
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
): RankedOpportunity["tier"] {
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

  return {
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
    scores,
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
  };
}

export async function scanDailyOpportunities(input: {
  userId: string;
  email: string | null;
  now?: Date;
  persistence?: "session" | "admin";
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
  const newsUnavailable = newsItems.length === 0;

  const technicalPool: Array<{
    symbol: string;
    trend: string;
    volatility: string;
    dataStatus: string;
  }> = [];
  const drafts: DraftCandidate[] = [];
  const diagnostics: OpportunityCandidateDiagnostic[] = [];
  const signalAssets: SignalAssetDiagnostic[] = [];
  let available = 0;
  let unavailable = 0;
  let liveOrCached = 0;
  let providerRateLimited = false;

  for (const asset of OPPORTUNITY_UNIVERSE) {
    if (providerRateLimited) {
      unavailable += 1;
      diagnostics.push(
        dataSkipDiagnostic({
          symbol: asset.symbol,
          assetType: asset.assetClass,
          quoteStatus: "UNAVAILABLE",
          technicalStatus: "UNAVAILABLE",
          reason: "provider_rate_limit",
        }),
      );
      signalAssets.push(
        buildSignalAssetDiagnostic({
          symbol: asset.symbol,
          assetType: asset.assetClass,
          quoteStatus: "UNAVAILABLE",
          snapshot: emptyTechnicalSnapshot(
            asset.symbol,
            DAILY_BRIEF_TIMEFRAME,
            "UNAVAILABLE",
            "DATA_UNAVAILABLE",
          ),
          setup: null,
          opportunityScore: null,
          tier: "DATA_SKIP",
          rejectionReason: "provider_rate_limit",
        }),
      );
      technicalPool.push({
        symbol: asset.symbol,
        trend: "UNKNOWN",
        volatility: "UNKNOWN",
        dataStatus: "UNAVAILABLE",
      });
      continue;
    }

    const unmapped = providerSkipReason(asset);
    if (unmapped) {
      unavailable += 1;
      diagnostics.push(
        dataSkipDiagnostic({
          symbol: asset.symbol,
          assetType: asset.assetClass,
          quoteStatus: "UNAVAILABLE",
          technicalStatus: "UNAVAILABLE",
          reason: unmapped,
        }),
      );
      signalAssets.push(
        buildSignalAssetDiagnostic({
          symbol: asset.symbol,
          assetType: asset.assetClass,
          quoteStatus: "UNAVAILABLE",
          snapshot: emptyTechnicalSnapshot(
            asset.symbol,
            DAILY_BRIEF_TIMEFRAME,
            "UNAVAILABLE",
            "DATA_UNAVAILABLE",
          ),
          setup: null,
          opportunityScore: null,
          tier: "DATA_SKIP",
          rejectionReason: unmapped,
        }),
      );
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
        signalAssets.push(
          buildSignalAssetDiagnostic({
            symbol: asset.symbol,
            assetType: asset.assetClass,
            quoteStatus,
            snapshot: technical.snapshot,
            setup: null,
            opportunityScore: null,
            tier: "DATA_SKIP",
            rejectionReason:
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
        diagnostics.push(
          dataSkipDiagnostic({
            symbol: asset.symbol,
            assetType: asset.assetClass,
            quoteStatus,
            technicalStatus: technical.snapshot.dataStatus,
            reason: "non_tradeable_asset_class",
          }),
        );
        signalAssets.push(
          buildSignalAssetDiagnostic({
            symbol: asset.symbol,
            assetType: asset.assetClass,
            quoteStatus,
            snapshot: technical.snapshot,
            setup: null,
            opportunityScore: null,
            tier: "DATA_SKIP",
            rejectionReason: "non_tradeable_asset_class",
          }),
        );
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
      if (reason === "provider_rate_limit") {
        providerRateLimited = true;
      }
      diagnostics.push(
        dataSkipDiagnostic({
          symbol: asset.symbol,
          assetType: asset.assetClass,
          quoteStatus,
          technicalStatus: "UNAVAILABLE",
          reason,
        }),
      );
      signalAssets.push(
        buildSignalAssetDiagnostic({
          symbol: asset.symbol,
          assetType: asset.assetClass,
          quoteStatus,
          snapshot: emptyTechnicalSnapshot(
            asset.symbol,
            DAILY_BRIEF_TIMEFRAME,
            "UNAVAILABLE",
            "DATA_UNAVAILABLE",
          ),
          setup: null,
          opportunityScore: null,
          tier: "DATA_SKIP",
          rejectionReason: reason,
        }),
      );
      technicalPool.push({
        symbol: asset.symbol,
        trend: "UNKNOWN",
        volatility: "UNKNOWN",
        dataStatus: "UNAVAILABLE",
      });
    }
  }

  const marketRegime: MarketRegime = detectMarketRegime(technicalPool);

  // Preliminary finalize to pick MTF enrichment targets (rate-limit safe)
  let preliminary = drafts.map((draft) =>
    finalizeCandidate({
      draft,
      marketRegime,
      newsUnavailable,
      scannedAt,
      nowMs,
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
      const mtfResult = await loadOptionalMtfSnapshots({
        market,
        symbol,
        rateLimited: providerRateLimited,
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

  const stocks = finalized.filter((item) => item.assetClass !== "CRYPTO");
  const cryptos = finalized.filter((item) => item.assetClass === "CRYPTO");
  const bestStock = selectBestOpportunity(stocks);
  const bestCrypto = selectBestOpportunity(cryptos);
  const partitioned = partitionByQuality(finalized);

  const rankedBoard = finalized
    .filter(
      (item) =>
        item.quality === "STRONG" ||
        item.quality === "CONFIRMED" ||
        item.quality === "EARLY_SETUP" ||
        item.quality === "WATCH",
    )
    .sort(compareOpportunityRank);

  const topStocks = rankedBoard
    .filter((item) => item.assetClass !== "CRYPTO")
    .slice(0, TOP_STOCK_LIMIT);
  const topCrypto = rankedBoard
    .filter((item) => item.assetClass === "CRYPTO")
    .slice(0, TOP_CRYPTO_LIMIT);

  const strong = finalized.filter((i) => i.quality === "STRONG").length;
  const confirmed = finalized.filter((i) => i.quality === "CONFIRMED").length;
  const earlySetup = partitioned.developing.length;
  const watch = partitioned.watch.length;
  const opportunities = confirmed; // legacy field: confirmed count
  const boardState = deriveBoardState({
    liveOrCached,
    confirmedOrStrong: strong + confirmed,
    earlyOrWatch: earlySetup + watch,
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

  console.info("[opportunity-scan] phase22 ranking", {
    boardState,
    bestStock: bestStock?.symbol ?? null,
    bestCrypto: bestCrypto?.symbol ?? null,
    strong,
    confirmed,
    earlySetup,
    watch,
    mtfEnriched: enrichTargets.length,
    freshness,
  });

  return {
    scanned: OPPORTUNITY_UNIVERSE.length,
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
    developing: partitioned.developing,
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
  };
}
