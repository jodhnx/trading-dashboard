import type { SetupDirection } from "@/engine/trading/types";
import type { DataStatus } from "@/services/market/provider";

export type AnalysisEligibility =
  | { eligible: true }
  | { eligible: false; reason: string };

export function isPipelineAnalysisEligible(input: {
  dataStatus: DataStatus | "UNAVAILABLE";
  setupDirection: SetupDirection;
}): AnalysisEligibility {
  if (
    input.dataStatus === "UNAVAILABLE" ||
    input.dataStatus === "MOCK" ||
    input.dataStatus === "STALE"
  ) {
    return { eligible: false, reason: `data_${input.dataStatus.toLowerCase()}` };
  }

  if (input.setupDirection === "NO_TRADE") {
    return { eligible: false, reason: "no_trade" };
  }

  if (input.setupDirection === "LONG" || input.setupDirection === "SHORT") {
    return { eligible: true };
  }

  return { eligible: false, reason: "invalid_setup" };
}
