import type { RankedOpportunity, SignalQuality } from "./types";
import { isHighConfidenceQuality, qualityRank } from "./quality";
import { isActionableOpportunity } from "./actionable";

export function compareOpportunityRank(
  a: RankedOpportunity,
  b: RankedOpportunity,
): number {
  const q = qualityRank(b.quality) - qualityRank(a.quality);
  if (q !== 0) return q;
  const score = b.scores.opportunityScore - a.scores.opportunityScore;
  if (score !== 0) return score;
  return a.symbol.localeCompare(b.symbol);
}

/**
 * bestStock / bestCrypto — CONFIRMED|STRONG + ELIGIBLE + valid levels + freshness.
 * Never substitutes WATCH / EARLY_SETUP / BLOCKED.
 */
export function selectBestOpportunity(
  candidates: RankedOpportunity[],
): RankedOpportunity | null {
  const eligible = candidates
    .filter((item) => isActionableOpportunity(item))
    .sort(compareOpportunityRank);
  return eligible[0] ?? null;
}

export function partitionByQuality(candidates: RankedOpportunity[]): {
  bestEligible: RankedOpportunity[];
  developing: RankedOpportunity[];
  blocked: RankedOpportunity[];
  watch: RankedOpportunity[];
  noTrade: RankedOpportunity[];
} {
  const bestEligible: RankedOpportunity[] = [];
  const developing: RankedOpportunity[] = [];
  const blocked: RankedOpportunity[] = [];
  const watch: RankedOpportunity[] = [];
  const noTrade: RankedOpportunity[] = [];

  for (const item of [...candidates].sort(compareOpportunityRank)) {
    if (item.tradeStatus === "BLOCKED") {
      blocked.push(item);
    } else if (
      isHighConfidenceQuality(item.quality) &&
      item.tradeStatus === "ELIGIBLE"
    ) {
      bestEligible.push(item);
    } else if (item.quality === "EARLY_SETUP") {
      developing.push(item);
    } else if (item.quality === "WATCH") {
      watch.push(item);
    } else {
      noTrade.push(item);
    }
  }

  return { bestEligible, developing, blocked, watch, noTrade };
}

export function whyNoBest(input: {
  assetClass: "STOCK" | "CRYPTO";
  candidates: RankedOpportunity[];
  liveOrCached: number;
}): string {
  if (input.liveOrCached === 0) {
    return `DATA_INSUFFICIENT — no usable LIVE/CACHED ${input.assetClass.toLowerCase()} technicals. WAIT.`;
  }
  const actionable = input.candidates.filter((c) => isActionableOpportunity(c));
  if (actionable.length > 0) {
    return "";
  }
  const blocked = input.candidates.filter((c) => c.tradeStatus === "BLOCKED");
  const developing = input.candidates.filter((c) => c.quality === "EARLY_SETUP");
  const watch = input.candidates.filter((c) => c.quality === "WATCH");
  if (blocked.length > 0) {
    return `NO CONFIRMED ${input.assetClass} SETUP — ${blocked.length} blocked by final gates (e.g. R:R). WAIT.`;
  }
  if (developing.length > 0) {
    return `NO CONFIRMED ${input.assetClass} SETUP — ${developing.length} developing (wait for confirmation).`;
  }
  if (watch.length > 0) {
    return `NO CONFIRMED ${input.assetClass} SETUP — watchlist only. WAIT.`;
  }
  return `NO CONFIRMED ${input.assetClass} SETUP — WAIT — no candidate meets all trading requirements.`;
}

export function qualityLabel(quality: SignalQuality): string {
  switch (quality) {
    case "STRONG":
      return "STRONG";
    case "CONFIRMED":
      return "CONFIRMED";
    case "EARLY_SETUP":
      return "DEVELOPING SETUP — WAIT FOR CONFIRMATION";
    case "WATCH":
      return "WATCH";
    case "NO_TRADE":
      return "NO_TRADE";
    default:
      return quality;
  }
}
