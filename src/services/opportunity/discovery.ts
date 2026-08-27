import type { BroadScreenResult } from "@/services/universe/types";
import type { RankedOpportunity } from "./types";
import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";

export const DISCOVERY_TAGS = [
  "UNUSUAL_VOLUME",
  "STRONG_MOMENTUM",
  "BREAKOUT",
  "NEWS_CATALYST",
  "SECTOR_STRENGTH",
  "VOLATILITY_EXPANSION",
  "RELATIVE_STRENGTH",
  "NEW_HIGH",
  "NEW_LOW",
] as const;
export type DiscoveryTag = (typeof DISCOVERY_TAGS)[number];

const LEGACY_SIGNAL_MAP: Record<string, DiscoveryTag> = {
  high_volume: "UNUSUAL_VOLUME",
  elevated_volume: "UNUSUAL_VOLUME",
  momentum_move: "STRONG_MOMENTUM",
  large_daily_move: "STRONG_MOMENTUM",
  crypto_volatility: "VOLATILITY_EXPANSION",
  breakout_proximity: "BREAKOUT",
  new_high: "NEW_HIGH",
  new_low: "NEW_LOW",
  sector_strength: "SECTOR_STRENGTH",
};

export function mapScreenSignalsToTags(signals: string[]): DiscoveryTag[] {
  const tags = new Set<DiscoveryTag>();
  for (const signal of signals) {
    const mapped = LEGACY_SIGNAL_MAP[signal];
    if (mapped) tags.add(mapped);
  }
  return [...tags];
}

export function deriveDiscoveryTags(input: {
  screen: BroadScreenResult | null;
  snapshot: TechnicalSnapshot;
  opportunity: RankedOpportunity;
}): DiscoveryTag[] {
  const tags = new Set<DiscoveryTag>(
    mapScreenSignalsToTags(input.screen?.signals ?? []),
  );
  const { screen, snapshot, opportunity } = input;

  if (
    screen?.signals.includes("high_volume") ||
    screen?.signals.includes("elevated_volume")
  ) {
    tags.add("UNUSUAL_VOLUME");
  }
  if (
    screen?.signals.includes("momentum_move") ||
    screen?.signals.includes("large_daily_move")
  ) {
    tags.add("STRONG_MOMENTUM");
  }
  if (screen?.signals.includes("crypto_volatility")) {
    tags.add("VOLATILITY_EXPANSION");
  }
  if (screen?.signals.includes("new_high")) {
    tags.add("NEW_HIGH");
  }
  if (screen?.signals.includes("new_low")) {
    tags.add("NEW_LOW");
  }
  if (screen?.signals.includes("sector_strength")) {
    tags.add("SECTOR_STRENGTH");
  }

  if (snapshot.trend === "BULLISH" && snapshot.momentum === "STRONG") {
    tags.add("RELATIVE_STRENGTH");
  }
  if (snapshot.trend === "BEARISH" && snapshot.momentum === "NEGATIVE") {
    tags.add("RELATIVE_STRENGTH");
  }

  if (
    opportunity.setupType === "BREAKOUT" ||
    opportunity.setupType === "MOMENTUM"
  ) {
    tags.add("BREAKOUT");
  }
  if (opportunity.newsItems.length > 0 && opportunity.scores.catalystScore >= 65) {
    tags.add("NEWS_CATALYST");
  }

  return [...tags];
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
