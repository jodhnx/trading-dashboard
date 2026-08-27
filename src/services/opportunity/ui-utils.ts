import type { AiResearchAction } from "./ai-research-shared";
import { calculatePositionRisk } from "./risk";
import type { RankedOpportunity } from "./types";
import type { RiskLevel } from "./risk";
import { deriveTradeAction, tradeActionLabel, type TradeAction } from "./actionable";
import { newsSentimentLabel } from "./news-impact";

export type PositionPlan = {
  accountCapital: number;
  recommendedRiskPercent: number | null;
  maximumRiskAmount: number | null;
  entry: number | null;
  stopLoss: number | null;
  stopDistance: number | null;
  stopDistancePercent: number | null;
  positionSize: number | null;
  potentialLoss: number | null;
  tp1Gain: number | null;
  tp2Gain: number | null;
  valid: boolean;
  reason: string | null;
};

export function formatOpportunityPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value >= 1000) return value.toFixed(0);
  if (value >= 10) return value.toFixed(2);
  return value.toFixed(4);
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatRiskPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "Not available";
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return "Not available";
  return new Date(ts).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function freshnessBadgeLabel(value: string | null | undefined): string {
  switch (value) {
    case "LIVE":
      return "Live";
    case "RECENT":
      return "Recent";
    case "CACHED":
      return "Cached";
    case "STALE":
      return "Stale";
    case "UNAVAILABLE":
      return "Unavailable";
    default:
      return "Unknown";
  }
}

export function aiActionLabel(action: AiResearchAction | null | undefined): string {
  switch (action) {
    case "ENTER_IN_ENTRY_ZONE":
      return "ENTER IN ENTRY ZONE";
    case "WAIT_FOR_ENTRY":
      return "WAIT FOR ENTRY";
    case "WAIT_FOR_CONFIRMATION":
      return "WAIT FOR CONFIRMATION";
    case "AVOID":
      return "AVOID";
    case "RESEARCH_MORE":
      return "RESEARCH MORE";
    default:
      return "—";
  }
}

export function explainTradeAction(
  action: TradeAction,
  item: Pick<
    RankedOpportunity,
    | "entry"
    | "entryZoneLow"
    | "entryZoneHigh"
    | "currentPrice"
    | "quality"
    | "tradeStatus"
    | "blockReason"
    | "waitingFor"
  >,
): string {
  switch (action) {
    case "ENTER_IN_ENTRY_ZONE":
      return "Technical setup is eligible and the stored price is inside the preferred entry zone.";
    case "WAIT_FOR_ENTRY":
      return "Technical setup is valid but the stored price is outside the preferred entry zone.";
    case "WAIT_FOR_CONFIRMATION":
      if (item.waitingFor[0]) return item.waitingFor[0];
      return "Setup is developing — trend, momentum, or confirmation is not complete.";
    case "DO_NOT_ENTER":
      return item.blockReason
        ? `Trade blocked: ${humanizeReason(item.blockReason)}.`
        : "Trade blocked by safety gates.";
    case "EXIT_THESIS_INVALIDATED":
      return "Thesis invalidation criteria are met on stored data.";
    case "NO_TRADE":
      return "No actionable trade on stored scan data today.";
  }
}

export function humanizeReason(reason: string): string {
  return reason.replace(/_/g, " ").toLowerCase();
}

export function explainBlocked(item: RankedOpportunity): string {
  if (item.tradeStatus !== "BLOCKED") return "";
  const reason = item.blockReason ?? "UNKNOWN";
  return `Technical confirmation exists, but this setup is not actionable because: ${humanizeReason(reason)}.`;
}

export function explainDataSkip(item: RankedOpportunity): string {
  if (item.boardQuality !== "DATA_SKIP" && item.quality !== "DATA_INSUFFICIENT") {
    return "";
  }
  return "Market data unavailable from the configured provider for this symbol. This is a data quality state — not a bearish market signal.";
}

export function computePositionPlan(input: {
  accountCapital: number;
  item: Pick<
    RankedOpportunity,
    "entry" | "stopLoss" | "takeProfit1" | "takeProfit2" | "direction"
  >;
  riskLevel: RiskLevel;
  recommendedRiskPercent: number | null;
}): PositionPlan {
  const entry = input.item.entry;
  const stop = input.item.stopLoss;
  const tp1 = input.item.takeProfit1;
  const tp2 = input.item.takeProfit2;

  if (
    entry === null ||
    stop === null ||
    !(entry > 0) ||
    !(stop > 0) ||
    entry === stop
  ) {
    return {
      accountCapital: input.accountCapital,
      recommendedRiskPercent: input.recommendedRiskPercent,
      maximumRiskAmount: null,
      entry,
      stopLoss: stop,
      stopDistance: null,
      stopDistancePercent: null,
      positionSize: null,
      potentialLoss: null,
      tp1Gain: null,
      tp2Gain: null,
      valid: false,
      reason: "Valid entry and stop are required for position planning.",
    };
  }

  const plan = calculatePositionRisk({
    portfolioCapital: input.accountCapital,
    riskLevel: input.riskLevel,
    entry,
    stopLoss: stop,
    riskPercentOverride: input.recommendedRiskPercent,
  });

  const stopDistance = Math.abs(entry - stop);
  const stopDistancePercent = (stopDistance / entry) * 100;
  const size = plan.positionSize;
  const direction = input.item.direction === "SHORT" ? -1 : 1;

  const tp1Gain =
    size !== null && tp1 !== null
      ? Math.abs((tp1 - entry) * size) * direction
      : null;
  const tp2Gain =
    size !== null && tp2 !== null
      ? Math.abs((tp2 - entry) * size) * direction
      : null;

  return {
    accountCapital: input.accountCapital,
    recommendedRiskPercent: plan.recommendedRiskPercent,
    maximumRiskAmount: plan.riskAmount,
    entry,
    stopLoss: stop,
    stopDistance,
    stopDistancePercent,
    positionSize: size,
    potentialLoss: plan.riskAmount,
    tp1Gain,
    tp2Gain,
    valid: size !== null,
    reason: size !== null ? null : "Position size could not be calculated.",
  };
}

export function latestTimestamp(values: Array<string | null | undefined>): string | null {
  let best: number | null = null;
  let bestIso: string | null = null;
  for (const value of values) {
    if (!value) continue;
    const ts = Date.parse(value);
    if (!Number.isFinite(ts)) continue;
    if (best === null || ts > best) {
      best = ts;
      bestIso = value;
    }
  }
  return bestIso;
}

export function deriveAiView(item: RankedOpportunity): {
  action: TradeAction | AiResearchAction;
  label: string;
  explanation: string;
  source: "ai" | "deterministic";
} {
  if (item.aiResearch && !item.aiResearch.unavailable) {
    return {
      action: item.aiResearch.action,
      label: aiActionLabel(item.aiResearch.action),
      explanation: item.aiResearch.summary,
      source: "ai",
    };
  }
  const action = deriveTradeAction(item);
  return {
    action,
    label: tradeActionLabel(action),
    explanation: explainTradeAction(action, item),
    source: "deterministic",
  };
}

export function pickBestActionable(
  items: RankedOpportunity[],
  assetClass: RankedOpportunity["assetClass"],
): RankedOpportunity | null {
  return (
    items.find(
      (item) =>
        item.assetClass === assetClass &&
        item.tradeStatus === "ELIGIBLE" &&
        (item.quality === "STRONG" || item.quality === "CONFIRMED") &&
        item.entry !== null &&
        item.stopLoss !== null,
    ) ?? null
  );
}

export function pickHighRiskCandidate(items: RankedOpportunity[]): RankedOpportunity | null {
  const ranked = [...items]
    .filter(
      (item) =>
        item.riskLevel === "EXTREME" ||
        item.riskLevel === "HIGH" ||
        item.boardQuality === "SPECULATIVE",
    )
    .sort((a, b) => b.scores.opportunityScore - a.scores.opportunityScore);
  return ranked[0] ?? null;
}

export function pickDevelopingSetup(items: RankedOpportunity[]): RankedOpportunity | null {
  return (
    items.find((item) => item.boardQuality === "DEVELOPING") ??
    items.find((item) => item.quality === "EARLY_SETUP") ??
    null
  );
}

export function collectSectors(items: RankedOpportunity[]): string[] {
  const sectors = new Set<string>();
  for (const item of items) {
    if (item.sector) sectors.add(item.sector);
  }
  return [...sectors].sort((a, b) => a.localeCompare(b));
}

export function sentimentMatches(
  item: RankedOpportunity,
  target: "POSITIVE" | "NEGATIVE" | "MIXED",
): boolean {
  return newsSentimentLabel(item.scores.sentimentScore) === target;
}

export function hasDiscoveryTag(
  item: RankedOpportunity,
  tag: string,
): boolean {
  return (item.discoveryTags ?? []).some(
    (value) => value.toUpperCase() === tag.toUpperCase(),
  );
}
