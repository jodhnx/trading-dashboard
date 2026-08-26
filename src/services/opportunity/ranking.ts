import type { RankedOpportunity, SignalQuality } from "./types";
import { isHighConfidenceQuality, qualityRank } from "./quality";

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

/** bestStock / bestCrypto — CONFIRMED or STRONG only (never force a trade). */
export function selectBestOpportunity(
  candidates: RankedOpportunity[],
): RankedOpportunity | null {
  const eligible = candidates
    .filter((item) => isHighConfidenceQuality(item.quality))
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
    } else if (item.quality === "STRONG" || item.quality === "CONFIRMED") {
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
    return `DATA_INSUFFICIENT — no usable LIVE/CACHED ${input.assetClass.toLowerCase()} technicals.`;
  }
  const developing = input.candidates.filter((c) => c.quality === "EARLY_SETUP");
  const watch = input.candidates.filter((c) => c.quality === "WATCH");
  if (developing.length === 0 && watch.length === 0) {
    return `No high-confidence ${input.assetClass.toLowerCase()} opportunity currently — evidence is weak or contradictory.`;
  }
  if (developing.length > 0) {
    return `No CONFIRMED/STRONG ${input.assetClass.toLowerCase()} setup — ${developing.length} developing setup(s) waiting for confirmation.`;
  }
  return `No high-confidence ${input.assetClass.toLowerCase()} opportunity currently — watchlist only.`;
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
