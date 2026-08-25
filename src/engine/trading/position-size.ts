import type { RejectReason } from "./types";

/** Absolute tolerance when comparing actualRisk to allowedRisk. */
export const RISK_EPSILON = 1e-8;

export type PositionSizeInput = {
  accountCapital: number;
  maxRiskPercent: number;
  maxPositionPercent: number;
  entry: number;
  riskPerUnit: number;
};

export type PositionSizeResult = {
  riskAmount: number;
  riskBasedPositionSize: number;
  maxPositionSize: number;
  positionSize: number;
  positionValue: number;
  actualRisk: number;
  cappedBy: "RISK" | "POSITION" | null;
  rejectReason: RejectReason | null;
};

export function allowedRiskAmount(
  accountCapital: number,
  maxRiskPercent: number,
): number {
  return accountCapital * maxRiskPercent;
}

/**
 * Risk-based size, then cap by max position notional.
 * After capping, actualRisk is recomputed and must stay <= allowedRisk
 * within RISK_EPSILON.
 */
export function sizePosition(input: PositionSizeInput): PositionSizeResult {
  const {
    accountCapital,
    maxRiskPercent,
    maxPositionPercent,
    entry,
    riskPerUnit,
  } = input;

  if (
    !(accountCapital > 0) ||
    !(maxRiskPercent > 0) ||
    !(maxPositionPercent > 0)
  ) {
    return invalidSize("INVALID_RISK");
  }
  if (!(entry > 0)) {
    return invalidSize("INVALID_ENTRY");
  }
  if (!(riskPerUnit > 0)) {
    return invalidSize("INVALID_RR");
  }

  const riskAmount = allowedRiskAmount(accountCapital, maxRiskPercent);
  if (!(riskAmount > 0)) {
    return invalidSize("INVALID_RISK");
  }

  const riskBasedPositionSize = riskAmount / riskPerUnit;
  const maxCapital = accountCapital * maxPositionPercent;
  const maxPositionSize = maxCapital / entry;

  let positionSize = Math.min(riskBasedPositionSize, maxPositionSize);
  const cappedBy: PositionSizeResult["cappedBy"] =
    maxPositionSize < riskBasedPositionSize - RISK_EPSILON
      ? "POSITION"
      : "RISK";

  if (positionSize * riskPerUnit > riskAmount + RISK_EPSILON) {
    positionSize = riskAmount / riskPerUnit;
  }

  if (!(positionSize > 0) || !Number.isFinite(positionSize)) {
    return {
      riskAmount,
      riskBasedPositionSize,
      maxPositionSize,
      positionSize: 0,
      positionValue: 0,
      actualRisk: 0,
      cappedBy,
      rejectReason: "POSITION_SIZE_ZERO",
    };
  }

  const actualRisk = positionSize * riskPerUnit;
  if (actualRisk > riskAmount + RISK_EPSILON) {
    return {
      riskAmount,
      riskBasedPositionSize,
      maxPositionSize,
      positionSize,
      positionValue: positionSize * entry,
      actualRisk,
      cappedBy,
      rejectReason: "RISK_LIMIT_EXCEEDED",
    };
  }

  return {
    riskAmount,
    riskBasedPositionSize,
    maxPositionSize,
    positionSize,
    positionValue: positionSize * entry,
    actualRisk,
    cappedBy,
    rejectReason: null,
  };
}

function invalidSize(reason: RejectReason): PositionSizeResult {
  return {
    riskAmount: Number.NaN,
    riskBasedPositionSize: Number.NaN,
    maxPositionSize: Number.NaN,
    positionSize: Number.NaN,
    positionValue: Number.NaN,
    actualRisk: Number.NaN,
    cappedBy: null,
    rejectReason: reason,
  };
}
