import type { TechnicalSnapshot } from "../technical/technical-snapshot";
import { MIN_SCORE_FOR_TRADE, scoreSetup } from "./score";
import { buildRiskLevels } from "./risk";
import { sizePosition } from "./position-size";
import {
  confirmationReasons,
  confirmationToDirection,
  evaluateSetupConfirmation,
  type SetupConfirmation,
} from "./confirmation";
import {
  labelsFor,
  uniqueReasons,
  validateDataStatus,
  validateRiskSettings,
} from "./validation";
import type {
  RejectReason,
  SetupDirection,
  TradingRiskSettings,
  TradingSetup,
} from "./types";

export type BuildTradingSetupInput = {
  snapshot: TechnicalSnapshot;
  settings: TradingRiskSettings;
  now?: Date;
  atrMultiplier?: number;
  minScoreForTrade?: number;
};

/**
 * Phase 21 confirmation model:
 * LONG: BULLISH trend + bullish momentum + (EMA bullish OR MACD positive)
 * SHORT: BEARISH trend + bearish momentum + (EMA bearish OR MACD negative)
 * All four aligned → strong confirmation reasons.
 * Never VALID without a directional trend. No orders — theoretical setup only.
 */
export function classifyDirection(snapshot: TechnicalSnapshot): {
  direction: SetupDirection;
  reasons: string[];
  rejectReasons: RejectReason[];
  confirmation: SetupConfirmation;
} {
  const confirmation = evaluateSetupConfirmation(snapshot);
  if (!confirmation.atrValid) {
    return {
      direction: "NO_TRADE",
      reasons: confirmationReasons(confirmation),
      rejectReasons: ["INSUFFICIENT_DATA"],
      confirmation,
    };
  }

  const direction = confirmationToDirection(confirmation);

  if (direction === "LONG" || direction === "SHORT") {
    return {
      direction,
      reasons: confirmationReasons(confirmation),
      rejectReasons: [],
      confirmation,
    };
  }

  const reasons = confirmationReasons(confirmation);
  const rejectReasons: RejectReason[] = ["NO_TRADE"];
  if (
    confirmation.explain.includes("EMA/MACD") ||
    confirmation.explain.includes("momentum")
  ) {
    rejectReasons.push("NO_TECHNICAL_EDGE");
  }
  return { direction: "NO_TRADE", reasons, rejectReasons, confirmation };
}

export function emptyTradingSetup(
  snapshot: TechnicalSnapshot,
  settings: TradingRiskSettings,
  extras: Partial<TradingSetup> = {},
): TradingSetup {
  return {
    symbol: snapshot.symbol,
    timeframe: snapshot.timeframe,
    direction: "NO_TRADE",
    status: "REJECTED",
    score: null,
    entry: null,
    stopLoss: null,
    takeProfit: null,
    riskPerUnit: null,
    rewardPerUnit: null,
    riskReward: null,
    accountCapital: settings.accountCapital,
    riskPercent: settings.maxRiskPercent,
    riskAmount: null,
    positionSize: null,
    positionValue: null,
    actualRisk: null,
    dataStatus: snapshot.dataStatus,
    reasons: [],
    rejectReasons: ["INSUFFICIENT_DATA"],
    confirmation: evaluateSetupConfirmation(snapshot),
    createdAt: extras.createdAt ?? new Date(),
    ...extras,
  };
}

/**
 * Build a theoretical TradingSetup from a TechnicalSnapshot and user risk settings.
 * Uses only snapshot fields — no candles, no news, no look-ahead.
 * Never places an order. Entry/SL/TP come only from buildRiskLevels + sizePosition.
 */
export function buildTradingSetup(input: BuildTradingSetupInput): TradingSetup {
  const now = input.now ?? new Date();
  const { snapshot, settings } = input;
  const minScore = input.minScoreForTrade ?? MIN_SCORE_FOR_TRADE;

  const settingsReject = validateRiskSettings(settings);
  if (settingsReject) {
    return emptyTradingSetup(snapshot, settings, {
      status: "INVALID",
      rejectReasons: [settingsReject],
      reasons: [labelsFor([settingsReject])[0]!],
      createdAt: now,
    });
  }

  const dataReject = validateDataStatus(snapshot);
  const classified = classifyDirection(snapshot);
  let direction = classified.direction;
  let confirmation = classified.confirmation;
  const scoreLong = scoreSetup(snapshot, direction === "SHORT" ? "SHORT" : "LONG");
  const scoreShort = scoreSetup(snapshot, "SHORT");
  const scoreBreakdown =
    direction === "SHORT"
      ? scoreShort
      : direction === "LONG"
        ? scoreLong
        : scoreLong.total >= scoreShort.total
          ? scoreLong
          : scoreShort;
  const score = snapshot.dataStatus === "UNAVAILABLE" ? null : scoreBreakdown.total;

  if (
    (direction === "LONG" || direction === "SHORT") &&
    (score === null || score < minScore)
  ) {
    classified.reasons.push("Score below the minimum technical edge");
    classified.rejectReasons.push("NO_TECHNICAL_EDGE");
    classified.rejectReasons.push("NO_TRADE");
    direction = "NO_TRADE";
    confirmation = {
      ...confirmation,
      direction: "NONE",
      confirmation: "WATCH",
      explain: "Technical score below minimum edge",
    };
  }

  const reasons = uniqueReasons([
    ...classified.reasons,
    ...scoreBreakdown.reasons,
  ]);
  let rejectReasons: RejectReason[] = uniqueRejects([
    ...(dataReject ? [dataReject] : []),
    ...classified.rejectReasons,
  ]);

  if (direction === "NO_TRADE" || dataReject === "INSUFFICIENT_DATA") {
    const status =
      dataReject === "INSUFFICIENT_DATA" ||
      dataReject === "STALE_DATA" ||
      dataReject === "MOCK_DATA" ||
      direction === "NO_TRADE"
        ? "REJECTED"
        : "INVALID";
    return emptyTradingSetup(snapshot, settings, {
      direction: "NO_TRADE",
      status,
      score,
      confirmation,
      reasons: uniqueReasons([...reasons, ...labelsFor(rejectReasons)]),
      rejectReasons: rejectReasons.length > 0 ? rejectReasons : ["NO_TRADE"],
      createdAt: now,
    });
  }

  const levels = buildRiskLevels({
    direction,
    snapshot,
    minimumRiskReward: settings.minimumRiskReward,
    atrMultiplier: input.atrMultiplier,
  });

  if (levels.invalid) {
    rejectReasons = uniqueRejects([...rejectReasons, levels.invalid]);
    const status =
      dataReject === "STALE_DATA" || dataReject === "MOCK_DATA"
        ? "REJECTED"
        : "INVALID";
    confirmation = {
      ...confirmation,
      rrValid: false,
      explain:
        levels.invalid === "INVALID_RR"
          ? "Risk/reward below minimum"
          : confirmation.explain,
    };
    return emptyTradingSetup(snapshot, settings, {
      direction,
      status,
      score,
      confirmation,
      entry: Number.isFinite(levels.entry) ? levels.entry : snapshot.currentPrice,
      stopLoss: Number.isFinite(levels.stopLoss) ? levels.stopLoss : null,
      takeProfit: Number.isFinite(levels.takeProfit) ? levels.takeProfit : null,
      riskPerUnit: Number.isFinite(levels.riskPerUnit) ? levels.riskPerUnit : null,
      rewardPerUnit: Number.isFinite(levels.rewardPerUnit)
        ? levels.rewardPerUnit
        : null,
      riskReward: Number.isFinite(levels.riskReward) ? levels.riskReward : null,
      reasons: uniqueReasons([
        ...reasons,
        ...levels.reasons,
        ...labelsFor(rejectReasons),
      ]),
      rejectReasons,
      createdAt: now,
    });
  }

  const sized = sizePosition({
    accountCapital: settings.accountCapital,
    maxRiskPercent: settings.maxRiskPercent,
    maxPositionPercent: settings.maxPositionPercent,
    entry: levels.entry,
    riskPerUnit: levels.riskPerUnit,
  });

  confirmation = {
    ...confirmation,
    rrValid: levels.riskReward >= settings.minimumRiskReward,
  };

  if (sized.rejectReason) {
    rejectReasons = uniqueRejects([...rejectReasons, sized.rejectReason]);
    const status =
      dataReject === "STALE_DATA" || dataReject === "MOCK_DATA"
        ? "REJECTED"
        : "INVALID";
    return emptyTradingSetup(snapshot, settings, {
      direction,
      status,
      score,
      confirmation,
      entry: levels.entry,
      stopLoss: levels.stopLoss,
      takeProfit: levels.takeProfit,
      riskPerUnit: levels.riskPerUnit,
      rewardPerUnit: levels.rewardPerUnit,
      riskReward: levels.riskReward,
      riskAmount: Number.isFinite(sized.riskAmount) ? sized.riskAmount : null,
      positionSize: Number.isFinite(sized.positionSize) ? sized.positionSize : null,
      positionValue: Number.isFinite(sized.positionValue)
        ? sized.positionValue
        : null,
      actualRisk: Number.isFinite(sized.actualRisk) ? sized.actualRisk : null,
      reasons: uniqueReasons([
        ...reasons,
        ...levels.reasons,
        ...labelsFor(rejectReasons),
      ]),
      rejectReasons,
      createdAt: now,
    });
  }

  if (dataReject) {
    rejectReasons = uniqueRejects([...rejectReasons, dataReject]);
    return {
      symbol: snapshot.symbol,
      timeframe: snapshot.timeframe,
      direction,
      status: "REJECTED",
      score,
      entry: levels.entry,
      stopLoss: levels.stopLoss,
      takeProfit: levels.takeProfit,
      riskPerUnit: levels.riskPerUnit,
      rewardPerUnit: levels.rewardPerUnit,
      riskReward: levels.riskReward,
      accountCapital: settings.accountCapital,
      riskPercent: settings.maxRiskPercent,
      riskAmount: sized.riskAmount,
      positionSize: sized.positionSize,
      positionValue: sized.positionValue,
      actualRisk: sized.actualRisk,
      dataStatus: snapshot.dataStatus,
      reasons: uniqueReasons([
        ...reasons,
        ...levels.reasons,
        ...labelsFor(rejectReasons),
      ]),
      rejectReasons,
      confirmation,
      createdAt: now,
    };
  }

  return {
    symbol: snapshot.symbol,
    timeframe: snapshot.timeframe,
    direction,
    status: "VALID",
    score,
    entry: levels.entry,
    stopLoss: levels.stopLoss,
    takeProfit: levels.takeProfit,
    riskPerUnit: levels.riskPerUnit,
    rewardPerUnit: levels.rewardPerUnit,
    riskReward: levels.riskReward,
    accountCapital: settings.accountCapital,
    riskPercent: settings.maxRiskPercent,
    riskAmount: sized.riskAmount,
    positionSize: sized.positionSize,
    positionValue: sized.positionValue,
    actualRisk: sized.actualRisk,
    dataStatus: snapshot.dataStatus,
    reasons: uniqueReasons([...reasons, ...levels.reasons]),
    rejectReasons: [],
    confirmation,
    createdAt: now,
  };
}

function uniqueRejects(reasons: RejectReason[]): RejectReason[] {
  const seen = new Set<RejectReason>();
  const out: RejectReason[] = [];
  for (const reason of reasons) {
    if (!seen.has(reason)) {
      seen.add(reason);
      out.push(reason);
    }
  }
  return out;
}
