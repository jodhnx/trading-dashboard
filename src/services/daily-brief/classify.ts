import type { BriefStatus } from "@/types/enums";
import type {
  BriefAiItem,
  BriefDataStatus,
  BriefMarketItem,
  BriefNoTradeItem,
  BriefOpportunityItem,
  BriefSetupItem,
  BriefTechnicalItem,
  BriefWatchItem,
} from "./types";

export function aggregateDataStatus(
  statuses: string[],
): BriefDataStatus {
  if (statuses.length === 0) {
    return "UNAVAILABLE";
  }
  const unique = new Set(statuses);
  if (unique.has("UNAVAILABLE") && unique.size === 1) {
    return "UNAVAILABLE";
  }
  if (unique.has("MOCK") && !unique.has("LIVE") && !unique.has("CACHED")) {
    return "MOCK";
  }
  if (unique.has("STALE") && !unique.has("LIVE")) {
    return "STALE";
  }
  if (unique.size === 1 && unique.has("LIVE")) {
    return "LIVE";
  }
  if (unique.size === 1 && unique.has("CACHED")) {
    return "CACHED";
  }
  if (unique.has("LIVE") || unique.has("CACHED") || unique.has("STALE") || unique.has("MOCK")) {
    return "MIXED";
  }
  return "UNAVAILABLE";
}

export function classifyMarketRegime(
  technicals: BriefTechnicalItem[],
): string {
  const known = technicals.filter((item) => item.trend !== "UNKNOWN");
  if (known.length === 0) {
    return "UNKNOWN";
  }
  const bullish = known.filter((item) => item.trend === "BULLISH").length;
  const bearish = known.filter((item) => item.trend === "BEARISH").length;
  const neutral = known.filter((item) => item.trend === "NEUTRAL").length;
  if (bullish > bearish && bullish >= neutral) {
    return "RISK_ON";
  }
  if (bearish > bullish && bearish >= neutral) {
    return "RISK_OFF";
  }
  return "MIXED";
}

export function classifyRiskEnvironment(input: {
  dataStatus: BriefDataStatus;
  setups: BriefSetupItem[];
  newsCount: number;
}): string {
  if (input.dataStatus === "UNAVAILABLE") {
    return "DATA_UNAVAILABLE";
  }
  if (input.dataStatus === "STALE" || input.dataStatus === "MOCK") {
    return "ELEVATED";
  }
  const invalid = input.setups.filter(
    (setup) => setup.status === "INVALID" || setup.rejectReasons.includes("STALE_DATA"),
  ).length;
  if (invalid > 0 || input.newsCount === 0) {
    return "CAUTIOUS";
  }
  const valid = input.setups.filter((setup) => setup.status === "VALID").length;
  if (valid > 0) {
    return "NORMAL";
  }
  return "CAUTIOUS";
}

export function buildOpportunities(
  setups: BriefSetupItem[],
): BriefOpportunityItem[] {
  return setups
    .filter(
      (setup) =>
        setup.status === "VALID" &&
        (setup.direction === "LONG" || setup.direction === "SHORT") &&
        setup.entry !== null &&
        setup.stopLoss !== null &&
        setup.takeProfit !== null,
    )
    .map((setup) => ({
      symbol: setup.symbol,
      direction: setup.direction as "LONG" | "SHORT",
      status: "VALID" as const,
      score: setup.score,
      entry: setup.entry,
      stopLoss: setup.stopLoss,
      takeProfit: setup.takeProfit,
      riskReward: setup.riskReward,
      positionSize: setup.positionSize,
      riskAmount: setup.riskAmount,
      reasons: setup.reasons,
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export function buildWatchlist(input: {
  setups: BriefSetupItem[];
  opportunities: BriefOpportunityItem[];
}): BriefWatchItem[] {
  const oppSymbols = new Set(input.opportunities.map((item) => item.symbol));
  const items: BriefWatchItem[] = [];
  for (const setup of input.setups) {
    if (oppSymbols.has(setup.symbol)) {
      continue;
    }
    if (setup.direction === "NO_TRADE") {
      continue;
    }
    if (setup.status === "VALID" || setup.status === "REJECTED") {
      items.push({
        symbol: setup.symbol,
        reason:
          setup.status === "VALID"
            ? "Valid setup without full opportunity criteria"
            : setup.reasons[0] ?? "Setup rejected — watch only",
        direction: setup.direction,
        status: setup.status,
        score: setup.score,
      });
    }
  }
  return items;
}

export function buildNoTradeAssets(setups: BriefSetupItem[]): BriefNoTradeItem[] {
  return setups
    .filter(
      (setup) =>
        setup.direction === "NO_TRADE" ||
        setup.status === "INVALID" ||
        setup.dataStatus === "UNAVAILABLE",
    )
    .map((setup) => ({
      symbol: setup.symbol,
      reasons:
        setup.reasons.length > 0
          ? setup.reasons
          : setup.dataStatus === "UNAVAILABLE"
            ? ["DATA UNAVAILABLE"]
            : ["NO TRADE"],
      rejectReasons: setup.rejectReasons,
      dataStatus: setup.dataStatus,
    }));
}

export function collectRisks(input: {
  dataStatus: BriefDataStatus;
  setups: BriefSetupItem[];
  market: BriefMarketItem[];
  newsCount: number;
  aiAnalyses: BriefAiItem[];
}): string[] {
  const risks: string[] = [];
  if (input.dataStatus === "UNAVAILABLE") {
    risks.push("Market data is DATA UNAVAILABLE for one or more assets.");
  }
  if (input.dataStatus === "STALE" || input.dataStatus === "MIXED") {
    risks.push("Some market data is stale or mixed freshness.");
  }
  if (input.dataStatus === "MOCK") {
    risks.push("Mock market data must not be treated as a live trading brief.");
  }
  if (input.newsCount === 0) {
    risks.push("No relevant news items were available for this brief.");
  }
  for (const setup of input.setups) {
    if (setup.rejectReasons.includes("STALE_DATA")) {
      risks.push(`${setup.symbol}: stale data blocked a live setup.`);
    }
    if (setup.rejectReasons.includes("MOCK_DATA")) {
      risks.push(`${setup.symbol}: mock data cannot produce a live setup.`);
    }
  }
  for (const item of input.market) {
    if (item.dataStatus === "UNAVAILABLE") {
      risks.push(`${item.symbol}: price DATA UNAVAILABLE.`);
    }
  }
  if (input.aiAnalyses.length === 0) {
    risks.push("No stored AI analyses were attached to this brief.");
  }
  return [...new Set(risks)];
}

export function deriveFinalStatus(input: {
  opportunities: BriefOpportunityItem[];
  watchlist: BriefWatchItem[];
  dataStatus: BriefDataStatus;
}): BriefStatus {
  if (input.dataStatus === "UNAVAILABLE" || input.dataStatus === "MOCK") {
    return "NO_TRADE";
  }
  if (input.opportunities.length > 0) {
    return "TRADE";
  }
  if (input.watchlist.length > 0) {
    return "WATCH";
  }
  return "NO_TRADE";
}

export function deterministicSummary(input: {
  briefDate: string;
  finalStatus: BriefStatus;
  marketRegime: string;
  riskEnvironment: string;
  opportunities: BriefOpportunityItem[];
  watchlist: BriefWatchItem[];
  noTrade: BriefNoTradeItem[];
  newsCount: number;
  dataStatus: BriefDataStatus;
}): string {
  const parts = [
    `Daily Brief for ${input.briefDate} (UTC).`,
    `Final status: ${input.finalStatus}.`,
    `Market regime: ${input.marketRegime}.`,
    `Risk environment: ${input.riskEnvironment}.`,
    `Data status: ${input.dataStatus}.`,
    `${input.opportunities.length} opportunity(ies), ${input.watchlist.length} watch item(s), ${input.noTrade.length} NO_TRADE asset(s).`,
    `${input.newsCount} news item(s) included.`,
    "Entry, stop, target, risk and position size come only from the Trading Engine.",
    "This brief is research only — not an executed order.",
  ];
  return parts.join(" ");
}
