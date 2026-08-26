import type { ImpactLevel, NewsCategory, Sentiment } from "@/types/enums";

export type NewsImpactInput = {
  id: string;
  title: string;
  category: NewsCategory | string;
  relevance: ImpactLevel | string;
  sentiment: Sentiment | string;
  publishedAt: Date | string;
  assetSymbols: string[];
};

function hoursSince(publishedAt: Date | string, now: Date): number {
  const ts =
    typeof publishedAt === "string" ? Date.parse(publishedAt) : publishedAt.getTime();
  if (!Number.isFinite(ts)) return 999;
  return Math.max(0, (now.getTime() - ts) / 3_600_000);
}

function relevanceWeight(relevance: string): number {
  if (relevance === "CRITICAL") return 100;
  if (relevance === "HIGH") return 80;
  if (relevance === "MEDIUM") return 55;
  if (relevance === "LOW") return 30;
  return 20;
}

function categoryCatalystBoost(category: string): number {
  switch (category) {
    case "EARNINGS":
      return 90;
    case "REGULATION":
      return 85;
    case "RATES":
    case "INFLATION":
      return 80;
    case "GEOPOLITICAL":
      return 75;
    case "CRYPTO":
      return 70;
    case "COMPANY":
      return 65;
    case "MACRO":
    case "MARKET":
      return 55;
    default:
      return 35;
  }
}

function sentimentScore(sentiment: string): number {
  if (sentiment === "POSITIVE") return 80;
  if (sentiment === "NEGATIVE") return 20;
  if (sentiment === "MIXED") return 45;
  return 50;
}

function recencyWeight(hours: number): number {
  if (hours <= 6) return 1;
  if (hours <= 24) return 0.85;
  if (hours <= 48) return 0.6;
  if (hours <= 72) return 0.4;
  return 0.15;
}

/**
 * Rank news impact for one symbol: impact × relevance × recency × category.
 * Deterministic — no LLM invention.
 */
export function scoreNewsForSymbol(input: {
  symbol: string;
  news: NewsImpactInput[];
  now?: Date;
}): {
  newsScore: number;
  catalystScore: number;
  sentimentScore: number;
  headlines: string[];
  ranked: Array<NewsImpactInput & { impactRank: number }>;
} {
  const now = input.now ?? new Date();
  const symbol = input.symbol.toUpperCase();
  const relevant = input.news.filter(
    (item) =>
      item.assetSymbols.length === 0 ||
      item.assetSymbols.map((s) => s.toUpperCase()).includes(symbol),
  );

  if (relevant.length === 0) {
    return {
      newsScore: 35,
      catalystScore: 20,
      sentimentScore: 50,
      headlines: [],
      ranked: [],
    };
  }

  const ranked = relevant
    .map((item) => {
      const hours = hoursSince(item.publishedAt, now);
      const impactRank =
        relevanceWeight(String(item.relevance)) *
        recencyWeight(hours) *
        (categoryCatalystBoost(String(item.category)) / 100);
      return { ...item, impactRank };
    })
    .sort((a, b) => b.impactRank - a.impactRank);

  const top = ranked.slice(0, 5);
  const newsScore =
    top.reduce((sum, item) => sum + Math.min(100, item.impactRank), 0) /
    Math.max(1, top.length);
  const catalystScore = Math.max(
    ...top.map((item) => categoryCatalystBoost(String(item.category)) * recencyWeight(hoursSince(item.publishedAt, now))),
    0,
  );
  const sentimentAvg =
    top.reduce((sum, item) => sum + sentimentScore(String(item.sentiment)), 0) /
    Math.max(1, top.length);

  return {
    newsScore: Math.min(100, Math.round(newsScore)),
    catalystScore: Math.min(100, Math.round(catalystScore)),
    sentimentScore: Math.min(100, Math.round(sentimentAvg)),
    headlines: top.slice(0, 3).map((item) => item.title),
    ranked,
  };
}

/**
 * Approximate news→price response annotation when change % is known.
 * Does not invent prices — only labels an observed move next to news.
 */
export function correlateNewsWithMove(input: {
  headline: string;
  changePercent: number | null;
}): string | null {
  if (input.changePercent === null || !Number.isFinite(input.changePercent)) {
    return null;
  }
  const signed = `${input.changePercent >= 0 ? "+" : ""}${input.changePercent.toFixed(1)}%`;
  return `${input.headline} (${signed})`;
}
