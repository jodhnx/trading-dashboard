import type { TechnicalSnapshot } from "../technical/technical-snapshot";
import { emaBearish, emaBullish, MIN_SCORE_FOR_TRADE, scoreSetup } from "./score";
import { buildRiskLevels } from "./risk";
import { sizePosition } from "./position-size";
import {
  hasRequiredTechnicalData,
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
 * LONG when all of:
 * - trend BULLISH
 * - momentum POSITIVE or STRONG
 * - price > EMA20 > EMA50 (and EMA50 > EMA200 when EMA200 exists)
 * - MACD histogram > 0
 *
 * SHORT is the inverse.
 * Any disagreement → NO_TRADE. LONG/SHORT is a theoretical setup, not an order.
 */
export function classifyDirection(snapshot: TechnicalSnapshot): {
  direction: SetupDirection;
  reasons: string[];
  rejectReasons: RejectReason[];
} {
  if (!hasRequiredTechnicalData(snapshot)) {
    return {
      direction: "NO_TRADE",
      reasons: [],
      rejectReasons: ["INSUFFICIENT_DATA"],
    };
  }

  const longReady =
    snapshot.trend === "BULLISH" &&
    (snapshot.momentum === "POSITIVE" || snapshot.momentum === "STRONG") &&
    emaBullish(snapshot) &&
    snapshot.macdHistogram !== null &&
    snapshot.macdHistogram > 0;

  const shortReady =
    snapshot.trend === "BEARISH" &&
    (snapshot.momentum === "NEGATIVE" || snapshot.momentum === "WEAK") &&
    emaBearish(snapshot) &&
    snapshot.macdHistogram !== null &&
    snapshot.macdHistogram < 0;

  if (longReady && !shortReady) {
    return {
      direction: "LONG",
      reasons: [
        "Bullish trend",
        "Momentum positive or strong",
        "Bullish EMA alignment",
        "Positive MACD",
      ],
      rejectReasons: [],
    };
  }
  if (shortReady && !longReady) {
    return {
      direction: "SHORT",
      reasons: [
        "Bearish trend",
        "Momentum negative or weak",
        "Bearish EMA alignment",
        "Negative MACD",
      ],
      rejectReasons: [],
    };
  }

  const reasons: string[] = [];
  const rejectReasons: RejectReason[] = ["NO_TRADE"];
  if (snapshot.trend === "NEUTRAL" || snapshot.trend === "UNKNOWN") {
    reasons.push("Trend is neutral");
  }
  if (
    snapshot.momentum === "NEUTRAL" ||
    snapshot.momentum === "UNKNOWN" ||
    (snapshot.trend === "BULLISH" &&
      snapshot.momentum !== "POSITIVE" &&
      snapshot.momentum !== "STRONG") ||
    (snapshot.trend === "BEARISH" &&
      snapshot.momentum !== "NEGATIVE" &&
      snapshot.momentum !== "WEAK")
  ) {
    reasons.push("Momentum is mixed or contradictory");
  }
  if (!longReady && !shortReady && reasons.length === 0) {
    reasons.push("Signals disagree");
    rejectReasons.push("NO_TECHNICAL_EDGE");
  }
  return { direction: "NO_TRADE", reasons, rejectReasons };
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
    createdAt: extras.createdAt ?? new Date(),
    ...extras,
  };
}

/**
 * Build a theoretical TradingSetup from a TechnicalSnapshot and user risk settings.
 * Uses only snapshot fields — no candles, no news, no look-ahead.
 * Never places an order.
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
      reasons: uniqueReasons([
        ...reasons,
        ...labelsFor(rejectReasons),
      ]),
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
    return emptyTradingSetup(snapshot, settings, {
      direction,
      status,
      score,
      entry: Number.isFinite(levels.entry) ? levels.entry : snapshot.currentPrice,
      stopLoss: Number.isFinite(levels.stopLoss) ? levels.stopLoss : null,
      takeProfit: Number.isFinite(levels.takeProfit) ? levels.takeProfit : null,
      riskPerUnit: Number.isFinite(levels.riskPerUnit) ? levels.riskPerUnit : null,
      rewardPerUnit: Number.isFinite(levels.rewardPerUnit)
        ? levels.rewardPerUnit
        : null,
      riskReward: Number.isFinite(levels.riskReward) ? levels.riskReward : null,
      reasons: uniqueReasons([...reasons, ...levels.reasons, ...labelsFor(rejectReasons)]),
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
      entry: levels.entry,
      stopLoss: levels.stopLoss,
      takeProfit: levels.takeProfit,
      riskPerUnit: levels.riskPerUnit,
      rewardPerUnit: levels.rewardPerUnit,
      riskReward: levels.riskReward,
      riskAmount: Number.isFinite(sized.riskAmount) ? sized.riskAmount : null,
      positionSize: Number.isFinite(sized.positionSize) ? sized.positionSize : null,
      positionValue: Number.isFinite(sized.positionValue) ? sized.positionValue : null,
      actualRisk: Number.isFinite(sized.actualRisk) ? sized.actualRisk : null,
      reasons: uniqueReasons([...reasons, ...levels.reasons, ...labelsFor(rejectReasons)]),
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
