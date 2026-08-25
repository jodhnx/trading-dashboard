import "server-only";

import { createMarketDataService } from "@/services/market/create-service";
import { createNewsService } from "@/services/news/create-service";
import { MARKET_WATCHLIST } from "@/services/market/symbols";
import {
  serializeTechnicalSnapshot,
  serializeTradingSetup,
} from "@/services/market/serialize";
import { getOrCreateAccountSettings } from "@/lib/settings/service";
import { toTradingRiskSettings } from "@/lib/settings/schema";
import { buildTradingSetup } from "@/engine/trading/setup";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listOwnAnalyses } from "@/services/ai/persistence";
import {
  aggregateDataStatus,
  buildNoTradeAssets,
  buildOpportunities,
  buildWatchlist,
  classifyMarketRegime,
  classifyRiskEnvironment,
  collectRisks,
  deriveFinalStatus,
  deterministicSummary,
} from "./classify";
import { briefDayBoundsUtc } from "./date";
import { DAILY_BRIEF_PROMPT_VERSION, DAILY_BRIEF_TIMEFRAME } from "./types";
import type { BriefPersistence } from "./persistence";
import type {
  BriefAiItem,
  BriefAiStatus,
  BriefMacroItem,
  BriefMarketItem,
  BriefNewsItem,
  BriefSetupItem,
  BriefTechnicalItem,
  DailyBriefInputSnapshot,
} from "./types";

export type AssembledBrief = {
  snapshot: DailyBriefInputSnapshot;
  marketRegime: string;
  riskEnvironment: string;
  summary: string;
  finalStatus: ReturnType<typeof deriveFinalStatus>;
};

async function loadMacroEvents(briefDate: string): Promise<BriefMacroItem[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { start, end } = briefDayBoundsUtc(briefDate);
    const { data, error } = await supabase
      .from("macro_events")
      .select("id, event_name, country, importance, scheduled_at, source")
      .gte("scheduled_at", start.toISOString())
      .lte("scheduled_at", end.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(20);
    if (error || !data) {
      return [];
    }
    return data.map((row) => ({
      id: row.id,
      eventName: row.event_name,
      country: row.country,
      importance: row.importance,
      scheduledAt: row.scheduled_at,
      source: row.source,
    }));
  } catch {
    return [];
  }
}

export async function assembleDailyBriefInput(input: {
  userId: string;
  email: string | null;
  briefDate: string;
  now?: Date;
  persistence?: BriefPersistence;
}): Promise<AssembledBrief> {
  const now = input.now ?? new Date();
  const generatedAt = now.toISOString();
  const symbols = MARKET_WATCHLIST.map((asset) => asset.symbol);
  const settings = await getOrCreateAccountSettings(input.userId, input.email, {
    persistence: input.persistence,
  });
  const risk = toTradingRiskSettings(settings);
  const market = createMarketDataService();

  const marketOverview: BriefMarketItem[] = [];
  const technicalConditions: BriefTechnicalItem[] = [];
  const tradingSetups: BriefSetupItem[] = [];
  const aiAnalyses: BriefAiItem[] = [];

  for (const symbol of symbols) {
    const quoteResult = await market.getQuote(symbol);
    marketOverview.push({
      symbol,
      name: quoteResult.name,
      price: quoteResult.quote?.price ?? null,
      changePercent: quoteResult.quote?.changePercent ?? null,
      dataStatus: quoteResult.status,
      asOf: quoteResult.quote?.dataTimestamp.toISOString() ?? null,
      source: quoteResult.source,
    });

    const technical = await market.getTechnicalSnapshot(
      symbol,
      DAILY_BRIEF_TIMEFRAME,
    );
    const serializedSnap = serializeTechnicalSnapshot(technical.snapshot);
    technicalConditions.push({
      symbol,
      timeframe: DAILY_BRIEF_TIMEFRAME,
      trend: technical.snapshot.trend,
      momentum: technical.snapshot.momentum,
      volatility: technical.snapshot.volatility,
      technicalCondition: technical.snapshot.technicalCondition,
      dataStatus: technical.snapshot.dataStatus,
      asOf: serializedSnap.asOf,
      snapshot: serializedSnap,
    });

    const setup = buildTradingSetup({
      snapshot: technical.snapshot,
      settings: risk,
      now,
    });
    const serializedSetup = serializeTradingSetup(setup);
    tradingSetups.push({
      symbol,
      direction: serializedSetup.direction,
      status: serializedSetup.status,
      score: serializedSetup.score,
      entry: serializedSetup.entry,
      stopLoss: serializedSetup.stopLoss,
      takeProfit: serializedSetup.takeProfit,
      riskReward: serializedSetup.riskReward,
      positionSize: serializedSetup.positionSize,
      riskAmount: serializedSetup.riskAmount,
      reasons: serializedSetup.reasons,
      rejectReasons: serializedSetup.rejectReasons,
      dataStatus: serializedSetup.dataStatus,
    });

    try {
      const analyses = await listOwnAnalyses({
        userId: input.userId,
        symbol,
        limit: 1,
        persistence: input.persistence,
      });
      const latest = analyses[0];
      if (latest) {
        aiAnalyses.push({
          id: latest.id,
          symbol,
          decision: latest.decision,
          confidence: latest.confidence,
          summary: latest.summary,
          analyzedAt: latest.analyzedAt,
          setupReference: latest.setupReference,
        });
      }
    } catch {
      // Stored AI analyses are optional for the brief.
    }
  }

  let importantNews: BriefNewsItem[] = [];
  let newsStatus = "UNAVAILABLE";
  try {
    const news = await createNewsService().listNews({ limit: 20 });
    newsStatus = news.status;
    importantNews = news.items.slice(0, 20).map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      publishedAt: item.publishedAt.toISOString(),
      category: item.category,
      relevance: item.relevance,
      sentiment: item.sentiment,
      assetSymbols: item.assetSymbols,
    }));
  } catch {
    importantNews = [];
    newsStatus = "UNAVAILABLE";
  }

  const macroEvents = await loadMacroEvents(input.briefDate);
  const dataStatus = aggregateDataStatus([
    ...marketOverview.map((item) => item.dataStatus),
    ...technicalConditions.map((item) => item.dataStatus),
  ]);
  const topOpportunities = buildOpportunities(tradingSetups);
  const watchlist = buildWatchlist({ setups: tradingSetups, opportunities: topOpportunities });
  const noTradeAssets = buildNoTradeAssets(tradingSetups);
  const risks = collectRisks({
    dataStatus,
    setups: tradingSetups,
    market: marketOverview,
    newsCount: importantNews.length,
    aiAnalyses,
  });
  const marketRegime = classifyMarketRegime(technicalConditions);
  const riskEnvironment = classifyRiskEnvironment({
    dataStatus,
    setups: tradingSetups,
    newsCount: importantNews.length,
  });
  const finalStatus = deriveFinalStatus({
    opportunities: topOpportunities,
    watchlist,
    dataStatus,
  });
  const aiStatus: BriefAiStatus = "SKIPPED";
  const summary = deterministicSummary({
    briefDate: input.briefDate,
    finalStatus,
    marketRegime,
    riskEnvironment,
    opportunities: topOpportunities,
    watchlist,
    noTrade: noTradeAssets,
    newsCount: importantNews.length,
    dataStatus,
  });

  const snapshot: DailyBriefInputSnapshot = {
    briefDate: input.briefDate,
    timezone: "UTC",
    timeframe: DAILY_BRIEF_TIMEFRAME,
    generatedAt,
    symbols,
    marketOverview,
    technicalConditions: technicalConditions.map((item) => ({
      ...item,
      // Keep snapshot compact for DB: drop full nested candle-free snapshot fields already in item
      snapshot: item.snapshot
        ? {
            ...item.snapshot,
            supportLevels: item.snapshot.supportLevels.slice(0, 3),
            resistanceLevels: item.snapshot.resistanceLevels.slice(0, 3),
          }
        : null,
    })),
    tradingSetups,
    importantNews,
    macroEvents,
    aiAnalyses: aiAnalyses,
    topOpportunities,
    watchlist,
    noTradeAssets,
    risks,
    dataStatus,
    newsStatus,
    aiStatus,
    model: null,
    promptVersion: DAILY_BRIEF_PROMPT_VERSION,
  };

  return {
    snapshot,
    marketRegime,
    riskEnvironment,
    summary,
    finalStatus,
  };
}
