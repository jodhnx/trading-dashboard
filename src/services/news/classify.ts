import type { ImpactLevel, NewsCategory } from "@/types/enums";

/**
 * Deterministic category rules (first match wins). Never invent a category
 * from a model guess — keyword evidence only, otherwise OTHER.
 *
 * 1. EARNINGS — earnings, EPS, quarterly results, guidance
 * 2. RATES — FOMC, Federal Reserve rate, interest rate decision, fed funds
 * 3. INFLATION — CPI, PCE, PPI, inflation
 * 4. REGULATION — SEC charges/lawsuit, antitrust, ban, regulatory
 * 5. GEOPOLITICAL — war, sanctions, invasion, tariffs
 * 6. CRYPTO — bitcoin, ethereum, crypto, blockchain
 * 7. MACRO — GDP, unemployment, payrolls, recession, jobs report
 * 8. COMPANY — unique watchlist company (NVIDIA / NVDA) without the above
 * 9. MARKET — S&P, Nasdaq, Dow, stock market, rally, selloff
 * 10. OTHER — default
 */
const CATEGORY_RULES: Array<{ category: NewsCategory; pattern: RegExp }> = [
  {
    category: "EARNINGS",
    pattern: /\b(earnings|eps|quarterly results|q[1-4] results|guidance)\b/i,
  },
  {
    category: "RATES",
    pattern:
      /\b(fomc|fed funds|interest rate|rate (cut|hike|decision)|federal reserve)\b/i,
  },
  {
    category: "INFLATION",
    pattern: /\b(cpi|pce|ppi|inflation)\b/i,
  },
  {
    category: "REGULATION",
    pattern: /\b(sec |antitrust|regulat(?:ion|ory)|lawsuit|banned?)\b/i,
  },
  {
    category: "GEOPOLITICAL",
    pattern: /\b(war|sanctions?|invasion|tariffs?|geopolitic)/i,
  },
  {
    category: "CRYPTO",
    pattern: /\b(bitcoin|ethereum|crypto|blockchain|btc)\b/i,
  },
  {
    category: "MACRO",
    pattern: /\b(gdp|unemployment|payrolls|recession|jobs report)\b/i,
  },
  {
    category: "COMPANY",
    pattern: /\b(nvidia|nvda)\b/i,
  },
  {
    category: "MARKET",
    pattern: /\b(s&p|nasdaq|dow jones|stock market|rally|selloff)\b/i,
  },
];

export function classifyCategory(text: string): NewsCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) {
      return rule.category;
    }
  }
  return "OTHER";
}

/**
 * Deterministic relevance when the source does not supply one.
 *
 * CRITICAL — trading halt, bankruptcy, emergency rate move, bank failure, SEC fraud charges
 * HIGH — watchlist earnings, FOMC decision, CPI print, spot ETF approval
 * MEDIUM — watchlist company mention, macro print, Fed speaker
 * LOW — everything else that passed validation
 */
export function classifyRelevance(text: string): ImpactLevel {
  if (
    /\b(trading halt|halted|bankruptcy|bank failure|emergency rate|sec charges.{0,40}fraud)\b/i.test(
      text,
    )
  ) {
    return "CRITICAL";
  }
  if (
    /\b((nvidia|nvda).{0,80}(earnings|quarterly results)|(earnings|quarterly results).{0,80}(nvidia|nvda)|fomc (decision|statement)|rate (cut|hike|decision)|cpi|spot bitcoin etf)\b/i.test(
      text,
    )
  ) {
    return "HIGH";
  }
  if (
    /\b(nvidia|nvda|bitcoin|s&p 500|nasdaq-100|gdp|payrolls|fed (chair|governor|speaker)|powell)\b/i.test(
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
