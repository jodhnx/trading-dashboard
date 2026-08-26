import type { RankedOpportunity } from "./types";
import type { RiskLevel } from "./risk";

export const BOARD_QUALITIES = [
  "TRADE",
  "DEVELOPING",
  "SPECULATIVE",
  "WATCH",
  "NO_TRADE",
  "DATA_SKIP",
] as const;
export type BoardQuality = (typeof BOARD_QUALITIES)[number];

export function deriveBoardQuality(
  item: Pick<
    RankedOpportunity,
    "quality" | "tradeStatus" | "technicalConfirmation" | "entry" | "stopLoss" | "takeProfit1"
  >,
  riskLevel: RiskLevel,
): BoardQuality {
  if (item.quality === "DATA_INSUFFICIENT") return "DATA_SKIP";

  const hasLevels =
    item.entry !== null &&
    item.stopLoss !== null &&
    item.takeProfit1 !== null;

  if (
    (item.quality === "STRONG" || item.quality === "CONFIRMED") &&
    item.tradeStatus === "ELIGIBLE" &&
    hasLevels
  ) {
    return "TRADE";
  }

  if (item.quality === "EARLY_SETUP" || item.technicalConfirmation === "EARLY_SETUP") {
    return "DEVELOPING";
  }

  if (
    riskLevel === "HIGH" ||
    riskLevel === "EXTREME" ||
    item.tradeStatus === "BLOCKED"
  ) {
    if (item.quality === "WATCH" || item.technicalConfirmation === "WATCH") {
      return "WATCH";
    }
    if (
      item.quality === "STRONG" ||
      item.quality === "CONFIRMED" ||
      item.technicalConfirmation === "STRONG"
    ) {
      return "SPECULATIVE";
    }
  }

  if (item.quality === "WATCH" || item.technicalConfirmation === "WATCH") {
    return "WATCH";
  }

  if (item.tradeStatus === "BLOCKED") {
    return "SPECULATIVE";
  }

  return "NO_TRADE";
}

export function boardQualityRank(quality: BoardQuality): number {
  switch (quality) {
    case "TRADE":
      return 6;
    case "DEVELOPING":
      return 5;
    case "SPECULATIVE":
      return 4;
    case "WATCH":
      return 3;
    case "NO_TRADE":
      return 2;
    case "DATA_SKIP":
      return 0;
    default:
      return 0;
  }
}

export function boardQualityLabel(quality: BoardQuality): string {
  switch (quality) {
    case "TRADE":
      return "TRADE";
    case "DEVELOPING":
      return "DEVELOPING";
    case "SPECULATIVE":
      return "SPECULATIVE / HIGH RISK";
    case "WATCH":
      return "WATCH";
    case "NO_TRADE":
      return "NO TRADE";
    case "DATA_SKIP":
      return "DATA UNAVAILABLE";
  }
}
