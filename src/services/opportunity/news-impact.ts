import type { ImpactLevel, NewsCategory, Sentiment } from "@/types/enums";
import type { OpportunityNewsItem } from "./types";
import { categoryLabel } from "@/services/news/classify";

export type NewsImpactInput = {
  id: string;
  title: string;
  category: NewsCategory | string;
  relevance: ImpactLevel | string;
  sentiment: Sentiment | string;
  publishedAt: Date | string;
  assetSymbols: string[];
  sourceName?: string | null;
};

function hoursSince(publishedAt: Date | string, now: Date): number {
  const ts =
    typeof publishedAt === "string" ? Date.parse(publishedAt) : publishedAt.getTime();
  if (!Number.isFinite(ts)) return 999;
  return Math.max(0, (now.getTime() - ts) / 3_600_000);
}

function toIso(publishedAt: Date | string): string | null {
  if (typeof publishedAt === "string") {
    const ts = Date.parse(publishedAt);
    return Number.isFinite(ts) ? new Date(ts).toISOString() : null;
  }
  return Number.isFinite(publishedAt.getTime()) ? publishedAt.toISOString() : null;
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
    case "GUIDANCE":
    case "REVENUE":
      return 90;
    case "REGULATION":
    case "LEGAL":
    case "HACK":
    case "SECURITY":
      return 85;
    case "INTEREST_RATES":
    case "RATES":
    case "INFLATION":
      return 80;
    case "GEOPOLITICAL":
      return 75;
    case "CRYPTO":
    case "CRYPTO_ETF":
    case "TOKEN_UNLOCK":
    case "NETWORK_UPGRADE":
      return 70;
    case "ACQUISITION":
    case "MERGER":
    case "PARTNERSHIP":
    case "PRODUCT":
    case "AI":
      return 68;
    case "UPGRADE":
    case "DOWNGRADE":
    case "ANALYST":
      return 65;
    case "BREAKOUT_CATALYST":
      return 72;
    case "COMPANY":
      return 65;
    case "MACRO":
    case "MARKET":
    case "ETF":
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

export function newsImpactLabel(score: number): "NONE" | "LOW" | "MEDIUM" | "HIGH" {
  if (score >= 70) return "HIGH";
  if (score >= 45) return "MEDIUM";
  if (score >= 25) return "LOW";
  return "NONE";
}

export function newsSentimentLabel(score: number): "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED" {
  if (score >= 65) return "POSITIVE";
  if (score <= 35) return "NEGATIVE";
  if (score >= 40 && score <= 55) return "MIXED";
  return "NEUTRAL";
}

export function explainNewsImpact(input: {
  newsScore: number;
  sentimentScore: number;
  topItems: OpportunityNewsItem[];
}): string {
  if (input.topItems.length === 0) {
    return "No relevant news detected for this symbol in the latest stored scan.";
  }
  const label = newsImpactLabel(input.newsScore);
  const sentiment = newsSentimentLabel(input.sentimentScore);
  const top = input.topItems[0]!;
  const category = categoryLabel(top.category);
  if (label === "HIGH" && sentiment === "POSITIVE") {
    return `High news impact: recent positive ${category.toLowerCase()} — ${top.title.slice(0, 80)}`;
  }
  if (label === "HIGH" && sentiment === "NEGATIVE") {
    return `Negative catalyst: ${category.toLowerCase()} — ${top.title.slice(0, 80)}`;
  }
  if (label === "MEDIUM") {
    return `Moderate news impact (${category.toLowerCase()}): ${top.title.slice(0, 80)}`;
  }
  return `Low news impact: ${top.title.slice(0, 80)}`;
}

export function deriveNewsTechnicalNote(input: {
  quality: string;
  tradeStatus: string;
  newsImpactLabel: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  newsSentimentLabel: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED";
}): string {
  const confirmed =
    input.quality === "STRONG" ||
    input.quality === "CONFIRMED" ||
    input.tradeStatus === "ELIGIBLE";
  const positiveNews =
    input.newsImpactLabel === "HIGH" && input.newsSentimentLabel === "POSITIVE";
  const negativeNews =
    input.newsImpactLabel === "HIGH" && input.newsSentimentLabel === "NEGATIVE";

  if (confirmed && positiveNews) {
    return "Technical setup supported by recent positive catalyst.";
  }
  if (!confirmed && positiveNews) {
    return "Positive catalyst detected, but technical confirmation is incomplete.";
  }
  if (confirmed && negativeNews) {
    return "Technical setup exists but current negative news increases thesis risk.";
  }
  if (input.newsImpactLabel === "NONE") {
    return "No material news catalyst in the latest stored scan.";
  }
  return "News is informational only and does not override technical gates.";
}

/**
 * Rank news impact for one symbol: relevance × recency × category × sentiment magnitude.
 * Deterministic — no LLM invention. News is optional for technically valid setups.
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
  newsItems: OpportunityNewsItem[];
  ranked: Array<NewsImpactInput & { impactRank: number }>;
  articleCount: number;
  latestNewsAt: string | null;
  impactLabel: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  sentimentLabel: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED";
  impactExplanation: string;
  primaryCatalyst: string | null;
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
      newsItems: [],
      ranked: [],
      articleCount: 0,
      latestNewsAt: null,
      impactLabel: "NONE",
      sentimentLabel: "NEUTRAL",
      impactExplanation: "No relevant news detected for this symbol in the latest stored scan.",
      primaryCatalyst: null,
    };
  }

  const ranked = relevant
    .map((item) => {
      const hours = hoursSince(item.publishedAt, now);
      const sentimentMag = Math.abs(sentimentScore(String(item.sentiment)) - 50) / 50 + 0.5;
      const impactRank =
        relevanceWeight(String(item.relevance)) *
        recencyWeight(hours) *
        (categoryCatalystBoost(String(item.category)) / 100) *
        sentimentMag;
      return { ...item, impactRank };
    })
    .sort((a, b) => b.impactRank - a.impactRank);

  const top = ranked.slice(0, 5);
  const newsScore =
    top.reduce((sum, item) => sum + Math.min(100, item.impactRank), 0) /
    Math.max(1, top.length);
  const catalystScore = Math.max(
    ...top.map(
      (item) =>
        categoryCatalystBoost(String(item.category)) *
        recencyWeight(hoursSince(item.publishedAt, now)),
    ),
    0,
  );
  const sentimentAvg =
    top.reduce((sum, item) => sum + sentimentScore(String(item.sentiment)), 0) /
    Math.max(1, top.length);

  const newsItems: OpportunityNewsItem[] = top.slice(0, 5).map((item) => ({
    title: item.title,
    source: item.sourceName ?? null,
    publishedAt: toIso(item.publishedAt),
    sentiment: String(item.sentiment),
    category: String(item.category),
    relevance: String(item.relevance),
    impactScore: Math.min(100, Math.round(item.impactRank)),
  }));

  const roundedNewsScore = Math.min(100, Math.round(newsScore));
  const roundedSentiment = Math.min(100, Math.round(sentimentAvg));
  const impactLabel = newsImpactLabel(roundedNewsScore);
  const sentimentLabel = newsSentimentLabel(roundedSentiment);

  return {
    newsScore: roundedNewsScore,
    catalystScore: Math.min(100, Math.round(catalystScore)),
    sentimentScore: roundedSentiment,
    headlines: newsItems.map((item) => item.title),
    newsItems,
    ranked,
    articleCount: relevant.length,
    latestNewsAt: newsItems[0]?.publishedAt ?? null,
    impactLabel,
    sentimentLabel,
    impactExplanation: explainNewsImpact({
      newsScore: roundedNewsScore,
      sentimentScore: roundedSentiment,
      topItems: newsItems,
    }),
    primaryCatalyst: newsItems[0]?.category ?? null,
  };
}

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
