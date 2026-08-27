import type { RankedOpportunity } from "./types";

export const AI_RESEARCH_ACTIONS = [
  "ENTER_IN_ENTRY_ZONE",
  "WAIT_FOR_ENTRY",
  "WAIT_FOR_CONFIRMATION",
  "AVOID",
  "RESEARCH_MORE",
] as const;

export type AiResearchAction = (typeof AI_RESEARCH_ACTIONS)[number];

export type AiResearchResult = {
  summary: string;
  bullCase: string;
  bearCase: string;
  keyCatalyst: string | null;
  mainRisk: string;
  technicalInterpretation: string;
  newsInterpretation: string;
  whyRanked: string;
  whatWouldInvalidate: string;
  researchConfidence: number;
  action: AiResearchAction;
  analyzedAt: string;
  unavailable?: boolean;
  error?: string;
};

export function selectAiResearchTargets(
  candidates: RankedOpportunity[],
  limit = 12,
): RankedOpportunity[] {
  return [...candidates]
    .filter(
      (item) =>
        item.quality !== "DATA_INSUFFICIENT" &&
        item.tier !== "NO_TRADE" &&
        item.dataFreshness !== "UNAVAILABLE" &&
        item.dataFreshness !== "STALE",
    )
    .sort(
      (a, b) =>
        b.scores.opportunityScore - a.scores.opportunityScore ||
        a.symbol.localeCompare(b.symbol),
    )
    .slice(0, limit);
}

export function mockResearch(candidate: RankedOpportunity, now: Date): AiResearchResult {
  return {
    summary: `${candidate.symbol} mock research from verified scan data only.`,
    bullCase: `Technical quality ${candidate.quality} with score ${candidate.scores.opportunityScore}.`,
    bearCase: `Data freshness ${candidate.dataFreshness}; tradeStatus ${candidate.tradeStatus}.`,
    keyCatalyst: candidate.newsItems[0]?.title ?? null,
    mainRisk: candidate.blockReason ?? candidate.risks[0] ?? "Standard market risk.",
    technicalInterpretation:
      candidate.confirmation?.explain ??
      `Trend ${candidate.confirmation?.trend ?? "UNKNOWN"}, momentum ${candidate.confirmation?.momentum ?? "UNKNOWN"}.`,
    newsInterpretation:
      candidate.newsItems.length > 0
        ? `${candidate.newsItems.length} relevant headlines in configured news sources.`
        : "No relevant headlines in configured news sources.",
    whyRanked: `Screen score ${candidate.screenScore ?? 0}, opportunity score ${candidate.scores.opportunityScore}.`,
    whatWouldInvalidate:
      candidate.waitingFor[0] ?? "Loss of current technical confirmation.",
    researchConfidence: Math.min(100, candidate.confidence),
    action:
      candidate.tradeStatus === "ELIGIBLE"
        ? "WAIT_FOR_ENTRY"
        : candidate.quality === "WATCH"
          ? "WAIT_FOR_CONFIRMATION"
          : "RESEARCH_MORE",
    analyzedAt: now.toISOString(),
  };
}

export function aiResearchUsesVerifiedDataOnly(
  research: AiResearchResult,
  candidate: RankedOpportunity,
): boolean {
  if (research.unavailable) return true;
  if (candidate.currentPrice === null) {
    return !/\$\d/.test(research.summary + research.technicalInterpretation);
  }
  return true;
}
