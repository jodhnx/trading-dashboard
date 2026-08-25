import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import type { TradingSetup } from "@/engine/trading/types";
import type { TradingRiskSettings } from "@/engine/trading/types";
import { classifyNewsFreshness } from "./freshness";
import { toTradingRiskPayload } from "./types";
import type {
  AnalysisNewsInput,
  AnalysisSetupReference,
  TradingAnalysisInput,
} from "./types";

export const MAX_ANALYSIS_NEWS = 10;

export type NewsForAnalysis = {
  id: string;
  title: string;
  summary: string | null;
  sourceName: string;
  sourceUrl: string;
  publishedAt: Date;
  category: string;
  relevance: string;
  sentiment: string;
};

export function buildTradingAnalysisInput(input: {
  symbol: string;
  timeframe: string;
  snapshot: TechnicalSnapshot;
  setup: TradingSetup;
  news: NewsForAnalysis[];
  settings: TradingRiskSettings;
  now?: Date;
}): TradingAnalysisInput {
  const now = input.now ?? new Date();
  const news = input.news.slice(0, MAX_ANALYSIS_NEWS).map(
    (item): AnalysisNewsInput => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      publishedAt: item.publishedAt.toISOString(),
      category: item.category,
      relevance: item.relevance,
      sentiment: item.sentiment,
      freshness: classifyNewsFreshness(item.publishedAt, now),
    }),
  );

  return {
    asset: input.symbol,
    timeframe: input.timeframe,
    marketData: {
      currentPrice: input.snapshot.currentPrice,
      previousClose: input.snapshot.previousClose,
      change: input.snapshot.change,
      changePercent: input.snapshot.changePercent,
      dataStatus: input.snapshot.dataStatus,
      asOf: input.snapshot.asOf ? input.snapshot.asOf.toISOString() : null,
    },
    technicalSnapshot: {
      ema20: input.snapshot.ema20,
      ema50: input.snapshot.ema50,
      ema200: input.snapshot.ema200,
      rsi14: input.snapshot.rsi14,
      macd: input.snapshot.macd,
      macdSignal: input.snapshot.macdSignal,
      macdHistogram: input.snapshot.macdHistogram,
      atr14: input.snapshot.atr14,
      currentVolume: input.snapshot.currentVolume,
      averageVolume20: input.snapshot.averageVolume20,
      volumeRatio: input.snapshot.volumeRatio,
      supportLevels: input.snapshot.supportLevels,
      resistanceLevels: input.snapshot.resistanceLevels,
      trend: input.snapshot.trend,
      momentum: input.snapshot.momentum,
      volatility: input.snapshot.volatility,
      technicalCondition: input.snapshot.technicalCondition,
    },
    tradingSetup: {
      direction: input.setup.direction,
      status: input.setup.status,
      score: input.setup.score,
      entry: input.setup.entry,
      stopLoss: input.setup.stopLoss,
      takeProfit: input.setup.takeProfit,
      riskPerUnit: input.setup.riskPerUnit,
      rewardPerUnit: input.setup.rewardPerUnit,
      riskReward: input.setup.riskReward,
      riskAmount: input.setup.riskAmount,
      positionSize: input.setup.positionSize,
      positionValue: input.setup.positionValue,
      actualRisk: input.setup.actualRisk,
      reasons: input.setup.reasons,
      rejectReasons: input.setup.rejectReasons,
      dataStatus: input.setup.dataStatus,
    },
    relevantNews: news,
    userRiskSettings: toTradingRiskPayload(input.settings),
  };
}

export function engineSetupReference(setup: TradingSetup): AnalysisSetupReference {
  return {
    entry: setup.entry,
    stopLoss: setup.stopLoss,
    takeProfit: setup.takeProfit,
    riskReward: setup.riskReward,
    positionSize: setup.positionSize,
  };
}
