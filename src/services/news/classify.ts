import type { ImpactLevel, NewsCategory, Sentiment } from "@/types/enums";

/**
 * Deterministic category rules (first match wins for primary category).
 * Keyword evidence only — never invent from model output.
 */
const CATEGORY_RULES: Array<{ category: NewsCategory; pattern: RegExp }> = [
  { category: "EARNINGS", pattern: /\b(earnings|eps|quarterly results|q[1-4] results)\b/i },
  { category: "GUIDANCE", pattern: /\b(guidance|outlook|forecast raised|forecast cut)\b/i },
  { category: "REVENUE", pattern: /\b(revenue|sales beat|sales miss|top[- ]line)\b/i },
  { category: "TOKEN_UNLOCK", pattern: /\b(token unlock|unlock schedule)\b/i },
  { category: "NETWORK_UPGRADE", pattern: /\b(network upgrade|hard fork|protocol upgrade)\b/i },
  { category: "HACK", pattern: /\b(hack(ed|er)?|exploit|drained|stolen funds)\b/i },
  { category: "SECURITY", pattern: /\b(security breach|vulnerability|cyber attack)\b/i },
  { category: "CRYPTO_ETF", pattern: /\b(spot (bitcoin|btc|ethereum|eth) etf|crypto etf)\b/i },
  { category: "ACQUISITION", pattern: /\b(acquires|acquisition|to buy|takeover bid)\b/i },
  { category: "MERGER", pattern: /\b(merger|merge with|all-stock deal)\b/i },
  { category: "PARTNERSHIP", pattern: /\b(partnership|partners with|collaborat(?:e|ion) with)\b/i },
  { category: "PRODUCT", pattern: /\b(launches|unveils|new product|product launch)\b/i },
  { category: "AI", pattern: /\b(artificial intelligence|\bai\b|machine learning|llm|generative ai)\b/i },
  { category: "STOCK_BUYBACK", pattern: /\b(buyback|share repurchase|repurchase program)\b/i },
  { category: "DIVIDEND", pattern: /\b(dividend|payout increase|special dividend)\b/i },
  { category: "CRYPTO_REGULATION", pattern: /\b(crypto regulation|digital asset regulation|sec crypto)\b/i },
  { category: "LIQUIDITY", pattern: /\b(liquidity (crunch|crisis|support)|margin call|funding rate)\b/i },
  { category: "SEMICONDUCTOR", pattern: /\b(semiconductor|chipmaker|foundry|wafer|gpu shortage)\b/i },
  { category: "CENTRAL_BANK", pattern: /\b(central bank|ecb|boj|pboc|bank of england)\b/i },
  { category: "INSIDER", pattern: /\b(insider (buy|sell|trading)|executive purchase|form 4)\b/i },
  { category: "ANALYST", pattern: /\b(analyst|price target|initiates coverage)\b/i },
  { category: "UPGRADE", pattern: /\b(upgrade[ds]? to|raised to (buy|overweight))\b/i },
  { category: "DOWNGRADE", pattern: /\b(downgrade[ds]? to|cut to (sell|underweight))\b/i },
  { category: "BREAKOUT_CATALYST", pattern: /\b(breakout|52-week high|all-time high|technical breakout)\b/i },
  { category: "INTEREST_RATES", pattern: /\b(fomc|fed funds|interest rate|rate (cut|hike|decision)|federal reserve)\b/i },
  { category: "RATES", pattern: /\b(yield curve|bond yields|treasury yields)\b/i },
  { category: "INFLATION", pattern: /\b(cpi|pce|ppi|inflation)\b/i },
  { category: "REGULATION", pattern: /\b(sec |antitrust|regulat(?:ion|ory)|lawsuit|banned?)\b/i },
  { category: "LEGAL", pattern: /\b(lawsuit|settlement|court ruling|indictment)\b/i },
  { category: "GEOPOLITICAL", pattern: /\b(war|sanctions?|invasion|tariffs?|geopolitic)/i },
  { category: "EXCHANGE", pattern: /\b(coinbase|binance|kraken|exchange listing|delisting)\b/i },
  { category: "ADOPTION", pattern: /\b(adoption|institutional adoption|onboarding|merchant accept)\b/i },
  { category: "ETF", pattern: /\b(etf flows|etf inflows|etf outflows|spdr|ishares)\b/i },
  { category: "CRYPTO", pattern: /\b(bitcoin|ethereum|crypto|blockchain|btc|eth)\b/i },
  { category: "MACRO", pattern: /\b(gdp|unemployment|payrolls|recession|jobs report)\b/i },
  { category: "MARKET", pattern: /\b(s&p|nasdaq|dow jones|stock market|rally|selloff)\b/i },
  { category: "COMPANY", pattern: /\b(nvidia|nvda|apple|aapl|microsoft|msft|tesla|tsla)\b/i },
];

export function classifyAllCategories(text: string): NewsCategory[] {
  const found = new Set<NewsCategory>();
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) {
      found.add(rule.category);
    }
  }
  return found.size > 0 ? [...found] : ["OTHER"];
}

export function classifyCategory(text: string): NewsCategory {
  return classifyAllCategories(text)[0] ?? "OTHER";
}

/** Deterministic sentiment from headline/summary keywords. */
export function classifySentiment(text: string): Sentiment {
  const positive =
    /\b(surge|soar|rally|beat|beats|raised guidance|upgrade|approval|approved|breakout|record high|bullish|inflow|jumps|gains|strong demand)\b/i;
  const negative =
    /\b(plunge|crash|miss|misses|cut guidance|downgrade|investigation|fraud|hack|bankruptcy|bearish|selloff|outflow|falls|weak demand|lawsuit)\b/i;
  const hasPos = positive.test(text);
  const hasNeg = negative.test(text);
  if (hasPos && hasNeg) return "MIXED";
  if (hasPos) return "POSITIVE";
  if (hasNeg) return "NEGATIVE";
  return "UNKNOWN";
}

export function classifyRelevance(text: string): ImpactLevel {
  if (
    /\b(trading halt|halted|bankruptcy|bank failure|emergency rate|sec charges.{0,40}fraud|hack|exploit)\b/i.test(
      text,
    )
  ) {
    return "CRITICAL";
  }
  if (
    /\b(earnings|quarterly results|fomc (decision|statement)|rate (cut|hike|decision)|cpi|spot bitcoin etf|token unlock)\b/i.test(
      text,
    )
  ) {
    return "HIGH";
  }
  if (
    /\b(bitcoin|ethereum|s&p 500|nasdaq-100|gdp|payrolls|fed (chair|governor|speaker)|powell|partnership|acquisition)\b/i.test(
      text,
    )
  ) {
    return "MEDIUM";
  }
  return "LOW";
}

export const RELEVANCE_SCORE: Record<ImpactLevel, number> = {
  LOW: 2.5,
  MEDIUM: 5,
  HIGH: 7.5,
  CRITICAL: 10,
};

export const RELEVANCE_RANK: Record<ImpactLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function relevanceFromScore(score: number | null): ImpactLevel {
  if (score === null || !Number.isFinite(score)) {
    return "LOW";
  }
  if (score >= 9) {
    return "CRITICAL";
  }
  if (score >= 7) {
    return "HIGH";
  }
  if (score >= 4) {
    return "MEDIUM";
  }
  return "LOW";
}

export function sortNewsByRelevanceThenTime<
  T extends { relevance: ImpactLevel; publishedAt: Date },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const rank = RELEVANCE_RANK[b.relevance] - RELEVANCE_RANK[a.relevance];
    if (rank !== 0) {
      return rank;
    }
    return b.publishedAt.getTime() - a.publishedAt.getTime();
  });
}

export function categoryLabel(category: string): string {
  return category.replace(/_/g, " ");
}
