import { MARKET_WATCHLIST } from "@/services/market/symbols";
import type {
  BriefAiStatus,
  BriefDataStatus,
  BriefMarketItem,
  BriefNewsItem,
  BriefNoTradeItem,
  BriefOpportunityItem,
  BriefWatchItem,
  DailyBriefRecord,
} from "@/services/daily-brief/types";

/** UI status derived only from stored BriefStatus — not a new trading decision. */
export type DashboardDecisionStatus =
  | "NO_TRADE"
  | "WATCHLIST"
  | "OPPORTUNITY";

export type DashboardMarketRegimeLabel =
  | "BULLISH"
  | "BEARISH"
  | "MIXED"
  | "UNKNOWN";

export type DashboardRiskLabel = "LOW" | "CAUTIOUS" | "HIGH" | "UNKNOWN";

export type DashboardHistoryItem = {
  briefDate: string;
  finalStatus: string;
  label: string;
  href: string;
  isToday: boolean;
};

export type DashboardWatchRow = {
  symbol: string;
  reason: string;
  technicalCondition: string;
  newsHeadline: string | null;
};

export type DashboardViewModel = {
  briefDate: string;
  generatedAt: string;
  decisionStatus: DashboardDecisionStatus;
  decisionTitle: string;
  decisionDetail: string;
  marketRegime: DashboardMarketRegimeLabel;
  riskEnvironment: DashboardRiskLabel;
  dataStatus: BriefDataStatus;
  isStale: boolean;
  isMock: boolean;
  aiStatus: BriefAiStatus;
  marketOverview: BriefMarketItem[];
  opportunities: BriefOpportunityItem[];
  watchlist: DashboardWatchRow[];
  noTradeAssets: BriefNoTradeItem[];
  news: BriefNewsItem[];
  risks: string[];
  freshness: {
    briefGenerated: string;
    marketData: string;
    news: string;
    ai: string;
  };
  history: DashboardHistoryItem[];
  summary: string;
};

export function mapDecisionStatus(
  finalStatus: DailyBriefRecord["finalStatus"],
): DashboardDecisionStatus {
  if (finalStatus === "TRADE") return "OPPORTUNITY";
  if (finalStatus === "WATCH") return "WATCHLIST";
  return "NO_TRADE";
}

export function mapMarketRegimeLabel(
  value: string | null | undefined,
): DashboardMarketRegimeLabel {
  const raw = (value ?? "UNKNOWN").toUpperCase();
  if (raw === "RISK_ON" || raw === "BULLISH") return "BULLISH";
  if (raw === "RISK_OFF" || raw === "BEARISH") return "BEARISH";
  if (raw === "MIXED") return "MIXED";
  return "UNKNOWN";
}

export function mapRiskEnvironmentLabel(
  value: string | null | undefined,
): DashboardRiskLabel {
  const raw = (value ?? "UNKNOWN").toUpperCase();
  if (raw === "NORMAL" || raw === "LOW") return "LOW";
  if (raw === "CAUTIOUS") return "CAUTIOUS";
  if (raw === "ELEVATED" || raw === "HIGH") return "HIGH";
  return "UNKNOWN";
}

export function buildDecisionCopy(brief: DailyBriefRecord): {
  title: string;
  detail: string;
} {
  const status = mapDecisionStatus(brief.finalStatus);
  if (status === "OPPORTUNITY") {
    const top = brief.topOpportunities[0];
    if (top) {
      return {
        title: "OPPORTUNITY",
        detail: `${top.symbol} ${top.direction} setup`,
      };
    }
    return {
      title: "OPPORTUNITY",
      detail: brief.summary || "Valid engine setup available.",
    };
  }
  if (status === "WATCHLIST") {
    const watched = brief.watchlist[0];
    return {
      title: "WATCHLIST",
      detail: watched
        ? `No valid trade yet. Monitor ${watched.symbol}.`
        : "No valid trade yet. Monitor the watchlist.",
    };
  }
  const reason =
    brief.noTradeAssets[0]?.reasons[0] ??
    brief.risks[0] ??
    "No valid engine setup today.";
  return {
    title: "NO TRADE",
    detail: reason,
  };
}

/**
 * Ensure watchlist order; never invent prices for missing symbols.
 * USD stays UNAVAILABLE when the brief has no verified quote.
 */
export function normalizeMarketOverview(
  items: BriefMarketItem[],
): BriefMarketItem[] {
  const bySymbol = new Map(items.map((item) => [item.symbol, item]));
  return MARKET_WATCHLIST.map((asset) => {
    const existing = bySymbol.get(asset.symbol);
    if (existing) {
      return existing;
    }
    return {
      symbol: asset.symbol,
      name: asset.name,
      price: null,
      changePercent: null,
      dataStatus: "UNAVAILABLE",
      asOf: null,
      source: null,
    };
  });
}

function latestTimestamp(values: Array<string | null | undefined>): string {
  const times = values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((value) => Date.parse(value))
    .filter((ms) => Number.isFinite(ms));
  if (times.length === 0) {
    return "UNKNOWN";
  }
  return new Date(Math.max(...times)).toISOString();
}

function formatHistoryLabel(
  briefDate: string,
  today: string,
): string {
  if (briefDate === today) return "Today";
  const todayMs = Date.parse(`${today}T00:00:00.000Z`);
  const dayMs = Date.parse(`${briefDate}T00:00:00.000Z`);
  if (
    Number.isFinite(todayMs) &&
    Number.isFinite(dayMs) &&
    todayMs - dayMs === 24 * 60 * 60 * 1000
  ) {
    return "Yesterday";
  }
  return briefDate;
}

export function buildWatchRows(brief: DailyBriefRecord): DashboardWatchRow[] {
  const techBySymbol = new Map(
    brief.technicalConditions.map((item) => [item.symbol, item]),
  );
  const newsBySymbol = new Map<string, string>();
  for (const item of brief.importantNews) {
    for (const symbol of item.assetSymbols) {
      if (!newsBySymbol.has(symbol)) {
        newsBySymbol.set(symbol, item.title);
      }
    }
  }
  return brief.watchlist.map((item: BriefWatchItem) => ({
    symbol: item.symbol,
    reason: item.reason,
    technicalCondition:
      techBySymbol.get(item.symbol)?.technicalCondition ?? "UNKNOWN",
    newsHeadline: newsBySymbol.get(item.symbol) ?? null,
  }));
}

export function buildHistoryItems(
  history: DailyBriefRecord[],
  today: string,
): DashboardHistoryItem[] {
  return history.map((item) => ({
    briefDate: item.briefDate,
    finalStatus: item.finalStatus,
    label: formatHistoryLabel(item.briefDate, today),
    href: `/daily-brief?date=${encodeURIComponent(item.briefDate)}`,
    isToday: item.briefDate === today,
  }));
}

/**
 * Pure mapping from persisted Daily Brief → dashboard UI model.
 * No provider calls. No new trading math.
 */
export function toDashboardViewModel(input: {
  brief: DailyBriefRecord;
  history: DailyBriefRecord[];
  today: string;
}): DashboardViewModel {
  const { brief } = input;
  const decision = buildDecisionCopy(brief);
  const marketOverview = normalizeMarketOverview(brief.marketOverview);

  return {
    briefDate: brief.briefDate,
    generatedAt: brief.generatedAt,
    decisionStatus: mapDecisionStatus(brief.finalStatus),
    decisionTitle: decision.title,
    decisionDetail: decision.detail,
    marketRegime: mapMarketRegimeLabel(brief.marketRegime),
    riskEnvironment: mapRiskEnvironmentLabel(brief.riskEnvironment),
    dataStatus: brief.dataStatus,
    isStale: brief.isStale,
    isMock: brief.isMock,
    aiStatus: brief.aiStatus,
    marketOverview,
    opportunities: brief.topOpportunities,
    watchlist: buildWatchRows(brief),
    noTradeAssets: brief.noTradeAssets,
    news: brief.importantNews,
    risks: brief.risks,
    freshness: {
      briefGenerated: brief.generatedAt,
      marketData: latestTimestamp(marketOverview.map((item) => item.asOf)),
      news: latestTimestamp(brief.importantNews.map((item) => item.publishedAt)),
      ai:
        brief.aiStatus === "ok"
          ? latestTimestamp(brief.aiAnalyses.map((item) => item.analyzedAt))
          : brief.aiStatus,
    },
    history: buildHistoryItems(input.history, input.today),
    summary: brief.summary,
  };
}
