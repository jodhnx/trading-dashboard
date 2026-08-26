import type { RankedOpportunity } from "./types";
import { isHighConfidenceQuality } from "./quality";

/**
 * Actionable = CONFIRMED/STRONG + ELIGIBLE + valid engine levels + acceptable freshness.
 * Never promotes WATCH / EARLY_SETUP / BLOCKED to bestStock/bestCrypto.
 */
export function hasValidTradeLevels(item: RankedOpportunity): boolean {
  return (
    item.entry !== null &&
    Number.isFinite(item.entry) &&
    item.entry > 0 &&
    item.stopLoss !== null &&
    Number.isFinite(item.stopLoss) &&
    item.stopLoss > 0 &&
    item.takeProfit1 !== null &&
    Number.isFinite(item.takeProfit1) &&
    item.takeProfit1 > 0 &&
    item.takeProfit2 !== null &&
    Number.isFinite(item.takeProfit2) &&
    item.takeProfit2 > 0 &&
    item.riskReward !== null &&
    Number.isFinite(item.riskReward) &&
    item.riskReward > 0 &&
    item.currentPrice !== null &&
    Number.isFinite(item.currentPrice) &&
    item.currentPrice > 0
  );
}

export function hasAcceptableFreshness(item: RankedOpportunity): boolean {
  return (
    item.dataFreshness === "LIVE" ||
    item.dataFreshness === "RECENT" ||
    item.dataFreshness === "CACHED"
  );
}

export function isActionableOpportunity(item: RankedOpportunity): boolean {
  return (
    isHighConfidenceQuality(item.quality) &&
    item.tradeStatus === "ELIGIBLE" &&
    (item.direction === "LONG" || item.direction === "SHORT") &&
    hasValidTradeLevels(item) &&
    hasAcceptableFreshness(item)
  );
}

export const TRADE_ACTIONS = [
  "ENTER_IN_ENTRY_ZONE",
  "WAIT_FOR_ENTRY",
  "WAIT_FOR_CONFIRMATION",
  "DO_NOT_ENTER",
  "EXIT_THESIS_INVALIDATED",
  "NO_TRADE",
] as const;
export type TradeAction = (typeof TRADE_ACTIONS)[number];

export function tradeActionLabel(action: TradeAction): string {
  switch (action) {
    case "ENTER_IN_ENTRY_ZONE":
      return "ENTER IN ENTRY ZONE";
    case "WAIT_FOR_ENTRY":
      return "WAIT FOR ENTRY";
    case "WAIT_FOR_CONFIRMATION":
      return "WAIT FOR CONFIRMATION";
    case "DO_NOT_ENTER":
      return "DO NOT ENTER";
    case "EXIT_THESIS_INVALIDATED":
      return "EXIT / THESIS INVALIDATED";
    case "NO_TRADE":
      return "NO TRADE — WAIT";
  }
}

/**
 * Deterministic action from opportunity state + optional live price.
 * Price outside entry zone → WAIT FOR ENTRY (still ELIGIBLE setup).
 */
export function deriveTradeAction(
  item: RankedOpportunity,
  currentPrice?: number | null,
): TradeAction {
  if (item.tradeStatus === "BLOCKED") return "DO_NOT_ENTER";
  if (item.quality === "EARLY_SETUP") return "WAIT_FOR_CONFIRMATION";
  if (item.quality === "WATCH") return "WAIT_FOR_CONFIRMATION";
  if (item.quality === "DATA_INSUFFICIENT") return "NO_TRADE";
  if (!isActionableOpportunity(item)) return "NO_TRADE";

  const price = currentPrice ?? item.currentPrice;
  const low = item.entryZoneLow ?? item.entry;
  const high = item.entryZoneHigh ?? item.entry;
  if (
    price !== null &&
    low !== null &&
    high !== null &&
    Number.isFinite(price) &&
    Number.isFinite(low) &&
    Number.isFinite(high)
  ) {
    const lo = Math.min(low, high);
    const hi = Math.max(low, high);
    if (price < lo || price > hi) {
      return "WAIT_FOR_ENTRY";
    }
  }
  return "ENTER_IN_ENTRY_ZONE";
}
