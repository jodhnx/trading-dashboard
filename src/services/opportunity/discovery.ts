import type { BroadScreenResult } from "@/services/universe/types";
import type { RankedOpportunity } from "./types";
import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";

export const DISCOVERY_TAGS = [
  "unusual_volume",
  "momentum_acceleration",
  "breakout",
  "reversal",
  "news_catalyst",
  "trend_transition",
  "volatility_expansion",
  "relative_strength",
  "oversold_recovery",
] as const;
export type DiscoveryTag = (typeof DISCOVERY_TAGS)[number];

export function deriveDiscoveryTags(input: {
  screen: BroadScreenResult | null;
  snapshot: TechnicalSnapshot;
  opportunity: RankedOpportunity;
}): DiscoveryTag[] {
  const tags: DiscoveryTag[] = [];
  const { screen, snapshot, opportunity } = input;

  if (
    screen?.signals.includes("high_volume") ||
    screen?.signals.includes("elevated_volume")
  ) {
    tags.push("unusual_volume");
  }
  if (
    screen?.signals.includes("momentum_move") ||
    screen?.signals.includes("large_daily_move")
  ) {
    tags.push("momentum_acceleration");
  }
  if (screen?.signals.includes("crypto_volatility")) {
    tags.push("volatility_expansion");
  }

  if (snapshot.trend === "BULLISH" && snapshot.momentum === "STRONG") {
    tags.push("relative_strength");
  }
  if (snapshot.trend === "BEARISH" && snapshot.momentum === "NEGATIVE") {
    tags.push("relative_strength");
  }

  if (
    opportunity.setupType === "BREAKOUT" ||
    opportunity.setupType === "MOMENTUM"
  ) {
    tags.push("breakout");
  }
  if (
    opportunity.setupType === "REVERSAL" ||
    opportunity.setupType === "MEAN_REVERSION"
  ) {
    tags.push("reversal");
    if (snapshot.momentum === "POSITIVE" && snapshot.trend === "BEARISH") {
      tags.push("oversold_recovery");
    }
  }
  if (opportunity.newsItems.length > 0 && opportunity.scores.catalystScore >= 65) {
    tags.push("news_catalyst");
  }
  if (
    opportunity.quality === "EARLY_SETUP" ||
    opportunity.technicalConfirmation === "EARLY_SETUP"
  ) {
    tags.push("trend_transition");
  }

  return [...new Set(tags)];
}

export function isDiscoveredCandidate(input: {
  tags: DiscoveryTag[];
  screenScore: number;
  opportunityScore: number;
  symbol: string;
  famousSymbols: Set<string>;
}): boolean {
  if (input.tags.length === 0) return false;
  if (!input.famousSymbols.has(input.symbol) && input.screenScore >= 15) {
    return true;
  }
  if (input.tags.length >= 2 && input.opportunityScore >= 55) {
    return true;
  }
  return input.screenScore >= 25 && input.opportunityScore >= 60;
}

export const FAMOUS_SYMBOLS = new Set([
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "META",
  "GOOGL",
  "TSLA",
  "BTC",
  "ETH",
  "SPY",
  "QQQ",
]);
