import type { RankedOpportunity } from "./types";
import { boardQualityRank } from "./board-quality";
import { qualityRank } from "./quality";
import { isActionableOpportunity } from "./actionable";
import {
  newsImpactLabel,
  newsSentimentLabel,
  explainNewsImpact,
  deriveNewsTechnicalNote,
} from "./news-impact";

export type TableSortKey =
  | "default"
  | "score"
  | "risk"
  | "newsImpact"
  | "newsRecency"
  | "riskReward"
  | "symbol"
  | "discovery"
  | "freshness";

export type TableFilter =
  | "ALL"
  | "STOCK"
  | "CRYPTO"
  | "ETF"
  | "TRADE"
  | "DEVELOPING"
  | "SPECULATIVE"
  | "WATCH"
  | "BLOCKED"
  | "NO_TRADE"
  | "DATA_SKIP"
  | "LOW_RISK"
  | "MEDIUM_RISK"
  | "HIGH_RISK"
  | "EXTREME_RISK"
  | "LONG"
  | "SHORT"
  | "NEWS_POSITIVE"
  | "NEWS_NEGATIVE"
  | "NEWS_MIXED"
  | "HIGH_NEWS_IMPACT"
  | "RECENT_NEWS"
  | "HIGH_SCORE"
  | "FRESH_DATA"
  | "DISCOVERED"
  | "BREAKOUT"
  | "UNUSUAL_VOLUME";

export function freshnessRank(value: string | undefined): number {
  switch (value) {
    case "LIVE":
      return 5;
    case "RECENT":
      return 4;
    case "CACHED":
      return 3;
    case "STALE":
      return 2;
    case "UNAVAILABLE":
      return 0;
    default:
      return 0;
  }
}

export function compareTableRank(a: RankedOpportunity, b: RankedOpportunity): number {
  const actionableA = isActionableOpportunity(a) ? 1 : 0;
  const actionableB = isActionableOpportunity(b) ? 1 : 0;
  if (actionableA !== actionableB) return actionableB - actionableA;

  const boardA = a.boardQuality ? boardQualityRank(a.boardQuality) : qualityRank(a.quality);
  const boardB = b.boardQuality ? boardQualityRank(b.boardQuality) : qualityRank(b.quality);
  if (boardA !== boardB) return boardB - boardA;

  const score = b.scores.opportunityScore - a.scores.opportunityScore;
  if (score !== 0) return score;

  const news = b.scores.newsScore - a.scores.newsScore;
  if (news !== 0) return news;

  const fresh = freshnessRank(b.dataFreshness) - freshnessRank(a.dataFreshness);
  if (fresh !== 0) return fresh;

  return a.symbol.localeCompare(b.symbol);
}

function parseTime(value: string | null | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : Number.NEGATIVE_INFINITY;
}

export function sortCandidates(
  items: RankedOpportunity[],
  key: TableSortKey,
): RankedOpportunity[] {
  const sorted = [...items];
  switch (key) {
    case "default":
      return sorted.sort(compareTableRank);
    case "score":
      return sorted.sort(
        (a, b) =>
          (b.scores.opportunityScore ?? Number.NEGATIVE_INFINITY) -
            (a.scores.opportunityScore ?? Number.NEGATIVE_INFINITY) ||
          a.symbol.localeCompare(b.symbol),
      );
    case "risk": {
      const riskOrder = { LOW: 1, MEDIUM: 2, HIGH: 3, EXTREME: 4, UNKNOWN: 0 };
      return sorted.sort((a, b) => {
        const ar = riskOrder[a.riskLevel ?? "UNKNOWN"];
        const br = riskOrder[b.riskLevel ?? "UNKNOWN"];
        return br - ar || compareTableRank(a, b);
      });
    }
    case "newsImpact":
      return sorted.sort(
        (a, b) =>
          (b.scores.newsScore ?? Number.NEGATIVE_INFINITY) -
            (a.scores.newsScore ?? Number.NEGATIVE_INFINITY) ||
          a.symbol.localeCompare(b.symbol),
      );
    case "newsRecency":
      return sorted.sort((a, b) => {
        const at = parseTime(a.newsItems[0]?.publishedAt ?? null);
        const bt = parseTime(b.newsItems[0]?.publishedAt ?? null);
        return bt - at || compareTableRank(a, b);
      });
    case "riskReward":
      return sorted.sort(
        (a, b) =>
          (b.riskReward ?? Number.NEGATIVE_INFINITY) -
            (a.riskReward ?? Number.NEGATIVE_INFINITY) ||
          a.symbol.localeCompare(b.symbol),
      );
    case "symbol":
      return sorted.sort((a, b) => a.symbol.localeCompare(b.symbol));
    case "discovery":
      return sorted.sort(
        (a, b) =>
          (b.screenScore ?? Number.NEGATIVE_INFINITY) -
            (a.screenScore ?? Number.NEGATIVE_INFINITY) ||
          compareTableRank(a, b),
      );
    case "freshness":
      return sorted.sort(
        (a, b) =>
          freshnessRank(b.dataFreshness) - freshnessRank(a.dataFreshness) ||
          compareTableRank(a, b),
      );
    default:
      return sorted.sort(compareTableRank);
  }
}

export function matchesTableFilter(item: RankedOpportunity, filter: TableFilter): boolean {
  switch (filter) {
    case "ALL":
      return true;
    case "STOCK":
      return item.assetClass === "STOCK";
    case "CRYPTO":
      return item.assetClass === "CRYPTO";
    case "ETF":
      return item.assetClass === "ETF";
    case "TRADE":
      return item.boardQuality === "TRADE";
    case "DEVELOPING":
      return item.boardQuality === "DEVELOPING";
    case "SPECULATIVE":
      return item.boardQuality === "SPECULATIVE";
    case "WATCH":
      return item.boardQuality === "WATCH";
    case "BLOCKED":
      return item.tradeStatus === "BLOCKED";
    case "NO_TRADE":
      return item.boardQuality === "NO_TRADE" || item.quality === "NO_TRADE";
    case "DATA_SKIP":
      return item.boardQuality === "DATA_SKIP" || item.quality === "DATA_INSUFFICIENT";
    case "LOW_RISK":
      return item.riskLevel === "LOW";
    case "MEDIUM_RISK":
      return item.riskLevel === "MEDIUM";
    case "HIGH_RISK":
      return item.riskLevel === "HIGH";
    case "EXTREME_RISK":
      return item.riskLevel === "EXTREME";
    case "LONG":
      return item.direction === "LONG";
    case "SHORT":
      return item.direction === "SHORT";
    case "NEWS_POSITIVE":
      return newsSentimentLabel(item.scores.sentimentScore) === "POSITIVE";
    case "NEWS_NEGATIVE":
      return newsSentimentLabel(item.scores.sentimentScore) === "NEGATIVE";
    case "NEWS_MIXED":
      return newsSentimentLabel(item.scores.sentimentScore) === "MIXED";
    case "HIGH_NEWS_IMPACT":
      return newsImpactLabel(item.scores.newsScore) === "HIGH";
    case "RECENT_NEWS": {
      const ts = parseTime(item.newsItems[0]?.publishedAt ?? null);
      return ts > Date.now() - 48 * 3_600_000;
    }
    case "HIGH_SCORE":
      return item.scores.opportunityScore >= 70;
    case "FRESH_DATA":
      return (
        item.dataFreshness === "LIVE" ||
        item.dataFreshness === "RECENT" ||
        item.dataFreshness === "CACHED"
      );
    case "DISCOVERED":
      return (item.discoveryTags?.length ?? 0) > 0;
    case "BREAKOUT":
      return (item.discoveryTags ?? []).some((tag) => tag.toUpperCase() === "BREAKOUT");
    case "UNUSUAL_VOLUME":
      return (item.discoveryTags ?? []).some(
        (tag) => tag.toUpperCase() === "UNUSUAL_VOLUME",
      );
    default:
      return true;
  }
}

export function filterCandidates(
  items: RankedOpportunity[],
  filters: TableFilter[],
  search: string,
  sector?: string | null,
): RankedOpportunity[] {
  const active = filters.filter((f) => f !== "ALL");
  const query = search.trim().toUpperCase();
  const sectorQuery = sector?.trim();
  return items.filter((item) => {
    if (query && !item.symbol.toUpperCase().includes(query) && !item.name.toUpperCase().includes(query)) {
      return false;
    }
    if (sectorQuery) {
      if ((item.sector ?? "Unknown") !== sectorQuery) return false;
    }
    if (active.length === 0) return true;
    return active.every((filter) => matchesTableFilter(item, filter));
  });
}

export function deriveWhyRanked(item: RankedOpportunity): string {
  const parts: string[] = [];
  if (item.boardQuality === "TRADE") {
    parts.push("Actionable trade quality with valid levels.");
  } else if (item.boardQuality === "DEVELOPING") {
    parts.push("Developing setup with partial confirmation.");
  } else if (item.boardQuality === "SPECULATIVE") {
    parts.push("Higher-risk candidate with interesting technical evidence.");
  } else if (item.boardQuality === "WATCH") {
    parts.push("Watch candidate awaiting confirmation.");
  } else if (item.tradeStatus === "BLOCKED") {
    parts.push(`Blocked: ${item.blockReason ?? "safety gate"}.`);
  } else {
    parts.push("No actionable trade today.");
  }
  parts.push(`Opportunity score ${item.scores.opportunityScore.toFixed(0)}.`);
  if (item.newsItems.length > 0) {
    parts.push(explainNewsImpact({
      newsScore: item.scores.newsScore,
      sentimentScore: item.scores.sentimentScore,
      topItems: item.newsItems.slice(0, 3),
    }));
  }
  return parts.join(" ");
}

export function deriveMissingConfirmation(item: RankedOpportunity): string[] {
  if (item.waitingFor.length > 0) return item.waitingFor;
  if (item.tradeStatus === "BLOCKED" && item.blockReason) {
    return [`Blocked because ${item.blockReason.replace(/_/g, " ").toLowerCase()}.`];
  }
  if (item.quality === "WATCH") {
    return ["Waiting for trend + momentum + (EMA OR MACD) confirmation."];
  }
  if (item.quality === "DATA_INSUFFICIENT") {
    return ["Provider data unavailable for this symbol."];
  }
  if (item.quality === "NO_TRADE") {
    return ["Engine rejects this setup today."];
  }
  return [];
}

export function buildNewsPresentation(item: RankedOpportunity) {
  const impactLabel = newsImpactLabel(item.scores.newsScore);
  const sentimentLabel = newsSentimentLabel(item.scores.sentimentScore);
  return {
    impactLabel,
    sentimentLabel,
    articleCount: item.newsItems.length,
    latestNewsAt: item.newsItems[0]?.publishedAt ?? null,
    catalyst: item.newsItems[0]?.category ?? null,
    impactExplanation: explainNewsImpact({
      newsScore: item.scores.newsScore,
      sentimentScore: item.scores.sentimentScore,
      topItems: item.newsItems.slice(0, 3),
    }),
    newsTechnicalNote: deriveNewsTechnicalNote({
      quality: item.quality,
      tradeStatus: item.tradeStatus,
      newsImpactLabel: impactLabel,
      newsSentimentLabel: sentimentLabel,
    }),
  };
}
