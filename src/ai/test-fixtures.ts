import { emptyTechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import { buildTradingSetup } from "@/engine/trading/setup";
import type { TradingRiskSettings, TradingSetup } from "@/engine/trading/types";
import { buildTradingAnalysisInput } from "./payload";
import type {
  AnalysisNewsInput,
  TradingAnalysisInput,
  TradingAnalysisOutput,
} from "./types";

export const TEST_SETTINGS: TradingRiskSettings = {
  accountCapital: 10_000,
  maxRiskPercent: 0.01,
  maxPositionPercent: 0.2,
  minimumRiskReward: 2,
};

export function liveSnapshot(
  overrides: Partial<TechnicalSnapshot> = {},
): TechnicalSnapshot {
  return {
    ...emptyTechnicalSnapshot("NVDA", "1day", "LIVE", null),
    currentPrice: 100,
    previousClose: 99,
    change: 1,
    changePercent: 1.01,
    ema20: 99,
    ema50: 97,
    ema200: 90,
    rsi14: 60,
    macd: 1.2,
    macdSignal: 0.8,
    macdHistogram: 0.4,
    atr14: 5,
    currentVolume: 1_000_000,
    averageVolume20: 800_000,
    volumeRatio: 1.25,
    trend: "BULLISH",
    momentum: "POSITIVE",
    volatility: "NORMAL",
    volumeTrend: "INCREASING",
    supportLevels: [],
    resistanceLevels: [],
    asOf: new Date("2026-08-24T18:00:00.000Z"),
    ...overrides,
  };
}

export function longSetup(now = new Date("2026-08-24T18:00:00.000Z")): TradingSetup {
  return buildTradingSetup({
    snapshot: liveSnapshot(),
    settings: TEST_SETTINGS,
    now,
    atrMultiplier: 1,
  });
}

export function shortSetup(now = new Date("2026-08-24T18:00:00.000Z")): TradingSetup {
  return buildTradingSetup({
    snapshot: liveSnapshot({
      currentPrice: 100,
      ema20: 102,
      ema50: 105,
      ema200: 110,
      rsi14: 35,
      macd: -1,
      macdSignal: -0.3,
      macdHistogram: -0.4,
      trend: "BEARISH",
      momentum: "NEGATIVE",
    }),
    settings: TEST_SETTINGS,
    now,
    atrMultiplier: 1,
  });
}

export const SAMPLE_NEWS: AnalysisNewsInput = {
  id: "news-nvda-1",
  title: "NVIDIA quarterly results",
  summary: "NVIDIA reported results.",
  sourceName: "Reuters",
  sourceUrl: "https://www.reuters.com/nvda",
  publishedAt: "2026-08-24T12:00:00.000Z",
  category: "EARNINGS",
  relevance: "HIGH",
  sentiment: "UNKNOWN",
  freshness: "CURRENT",
};

export function analysisInput(input: {
  setup: TradingSetup;
  snapshot?: TechnicalSnapshot;
  news?: AnalysisNewsInput[];
  dataStatus?: string;
}): TradingAnalysisInput {
  const snapshot = input.snapshot ?? liveSnapshot();
  const payload = buildTradingAnalysisInput({
    symbol: snapshot.symbol,
    timeframe: snapshot.timeframe,
    snapshot,
    setup: input.setup,
    news: (input.news ?? [SAMPLE_NEWS]).map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      publishedAt: new Date(item.publishedAt),
      category: item.category,
      relevance: item.relevance,
      sentiment: item.sentiment,
    })),
    settings: TEST_SETTINGS,
    now: new Date("2026-08-24T18:00:00.000Z"),
  });
  if (input.dataStatus) {
    payload.marketData.dataStatus = input.dataStatus;
    payload.tradingSetup.dataStatus = input.dataStatus;
  }
  return payload;
}

export function analysisOutput(
  setup: TradingSetup,
  overrides: Partial<TradingAnalysisOutput> = {},
): TradingAnalysisOutput {
  return {
    decision: "BUY_SETUP",
    confidence: 72,
    summary:
      "The provided LONG setup is consistent with the live technical snapshot.",
    thesis: ["Bullish trend and EMA alignment support the engine LONG setup."],
    risks: ["A break of the engine stop would invalidate the setup."],
    uncertainties: ["News coverage is limited to the supplied headlines."],
    supportingSignals: ["Headline: NVIDIA quarterly results"],
    contradictingSignals: [],
    newsImpact: "NEUTRAL",
    timeHorizon: "SWING",
    setupReference: {
      entry: setup.entry,
      stopLoss: setup.stopLoss,
      takeProfit: setup.takeProfit,
      riskReward: setup.riskReward,
      positionSize: setup.positionSize,
    },
    usedNewsIds: ["news-nvda-1"],
    ...overrides,
  };
}
