import type { TradingSetup } from "@/engine/trading/types";
import type { HoldingHorizon } from "./types";

/**
 * Entry / invalidation levels derived only from Trading Engine outputs + ATR context.
 * Never invent prices.
 */
export function deriveEntryPlan(input: {
  setup: TradingSetup;
  atr14: number | null;
}): {
  entryZoneLow: number | null;
  entryZoneHigh: number | null;
  maxChase: number | null;
  invalidation: number | null;
  takeProfit2: number | null;
  holdingHorizon: HoldingHorizon;
} {
  const { setup, atr14 } = input;
  if (
    setup.direction === "NO_TRADE" ||
    setup.entry === null ||
    setup.stopLoss === null ||
    setup.takeProfit === null
  ) {
    return {
      entryZoneLow: null,
      entryZoneHigh: null,
      maxChase: null,
      invalidation: null,
      takeProfit2: null,
      holdingHorizon: "UNKNOWN",
    };
  }

  const atr = atr14 !== null && atr14 > 0 ? atr14 : null;
  const band = atr !== null ? atr * 0.25 : setup.entry * 0.005;

  if (setup.direction === "LONG") {
    const risk = setup.entry - setup.stopLoss;
    const takeProfit2 =
      risk > 0 ? setup.entry + risk * Math.max(3, (setup.riskReward ?? 2) + 1) : null;
    return {
      entryZoneLow: setup.entry - band,
      entryZoneHigh: setup.entry + band * 0.5,
      maxChase: setup.entry + band,
      invalidation: setup.stopLoss,
      takeProfit2,
      holdingHorizon: atr !== null && atr / setup.entry > 0.03 ? "SWING" : "SWING",
    };
  }

  const risk = setup.stopLoss - setup.entry;
  const takeProfit2 =
    risk > 0 ? setup.entry - risk * Math.max(3, (setup.riskReward ?? 2) + 1) : null;
  return {
    entryZoneLow: setup.entry - band * 0.5,
    entryZoneHigh: setup.entry + band,
    maxChase: setup.entry - band,
    invalidation: setup.stopLoss,
    takeProfit2,
    holdingHorizon: "SWING",
  };
}
