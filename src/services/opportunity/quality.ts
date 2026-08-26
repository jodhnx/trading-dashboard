import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import type { TradingSetup } from "@/engine/trading/types";
import type { DataFreshness, SignalQuality } from "./types";
import { evaluateTradeEligibility } from "./trade-status";

export {
  toDataFreshness,
  freshnessAllowsConfirmed,
  freshnessConfidenceFactor,
} from "./quality-freshness";

/**
 * Phase 22 quality — delegates to trade-status separation.
 * BLOCKED technical STRONG → quality NO_TRADE (never fake WATCH).
 */
export function classifySignalQuality(input: {
  setup: TradingSetup;
  snapshot: TechnicalSnapshot;
  dataFreshness: DataFreshness;
  mtfAligned: boolean;
}): SignalQuality {
  void input.mtfAligned;
  return evaluateTradeEligibility(input).quality;
}

export function qualityRank(quality: SignalQuality): number {
  switch (quality) {
    case "STRONG":
      return 5;
    case "CONFIRMED":
      return 4;
    case "EARLY_SETUP":
      return 3;
    case "WATCH":
      return 2;
    case "NO_TRADE":
      return 1;
    default:
      return 0;
  }
}

export function isHighConfidenceQuality(quality: SignalQuality): boolean {
  return quality === "STRONG" || quality === "CONFIRMED";
}

export function isRankedBoardQuality(quality: SignalQuality): boolean {
  return (
    quality === "STRONG" ||
    quality === "CONFIRMED" ||
    quality === "EARLY_SETUP" ||
    quality === "WATCH"
  );
}
