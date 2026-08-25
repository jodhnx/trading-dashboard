import type { TechnicalSnapshot } from "../technical/technical-snapshot";
import type { TradingRiskSettings } from "./types";
import type { RejectReason, SetupDirection, SetupStatus } from "./types";
import { REJECT_REASON_LABELS } from "./types";
import { RISK_EPSILON } from "./position-size";

export function validateRiskSettings(
  settings: TradingRiskSettings,
): RejectReason | null {
  if (
    !(settings.accountCapital > 0) ||
    !(settings.maxRiskPercent > 0) ||
    !(settings.maxPositionPercent > 0) ||
    !(settings.minimumRiskReward > 0)
  ) {
    return "INVALID_RISK";
  }
  return null;
}

export function validateDataStatus(
  snapshot: TechnicalSnapshot,
): RejectReason | null {
  if (snapshot.dataStatus === "UNAVAILABLE" || snapshot.dataError) {
    return "INSUFFICIENT_DATA";
  }
  if (snapshot.dataStatus === "STALE") {
    return "STALE_DATA";
  }
  if (snapshot.dataStatus === "MOCK") {
    return "MOCK_DATA";
  }
  return null;
}

export function hasRequiredTechnicalData(snapshot: TechnicalSnapshot): boolean {
  return (
    snapshot.currentPrice !== null &&
    snapshot.currentPrice > 0 &&
    snapshot.ema20 !== null &&
    snapshot.ema50 !== null &&
    snapshot.rsi14 !== null &&
    snapshot.macdHistogram !== null &&
    snapshot.atr14 !== null &&
    snapshot.atr14 > 0
  );
}

export function isWithinRiskLimit(
  actualRisk: number,
  allowedRisk: number,
  epsilon: number = RISK_EPSILON,
): boolean {
  return actualRisk <= allowedRisk + epsilon;
}

export function uniqueReasons(reasons: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const reason of reasons) {
    if (!seen.has(reason)) {
      seen.add(reason);
      out.push(reason);
    }
  }
  return out;
}

export function labelsFor(reasons: RejectReason[]): string[] {
  return reasons.map((code) => REJECT_REASON_LABELS[code]);
}

export function resolveStatus(input: {
  direction: SetupDirection;
  dataReject: RejectReason | null;
  mathReject: RejectReason | null;
}): { status: SetupStatus; rejectReasons: RejectReason[] } {
  const rejectReasons: RejectReason[] = [];
  if (input.dataReject) {
    rejectReasons.push(input.dataReject);
  }
  if (input.mathReject) {
    rejectReasons.push(input.mathReject);
  }
  if (input.direction === "NO_TRADE") {
    if (!rejectReasons.includes("NO_TRADE")) {
      rejectReasons.push("NO_TRADE");
    }
  }

  if (input.dataReject === "INSUFFICIENT_DATA") {
    return { status: "REJECTED", rejectReasons };
  }
  if (input.dataReject === "STALE_DATA" || input.dataReject === "MOCK_DATA") {
    return { status: "REJECTED", rejectReasons };
  }
  if (input.mathReject) {
    return { status: "INVALID", rejectReasons };
  }
  if (input.direction === "NO_TRADE") {
    return { status: "REJECTED", rejectReasons };
  }
  return { status: "VALID", rejectReasons: [] };
}
