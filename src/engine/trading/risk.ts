import type { PriceLevel } from "../indicators/support-resistance";
import type { TechnicalSnapshot } from "../technical/technical-snapshot";
import type { SetupDirection } from "./types";

/**
 * ATR stop multiplier. LONG stop = entry − ATR × multiplier.
 * SHORT stop = entry + ATR × multiplier.
 */
export const ATR_STOP_MULTIPLIER = 1.5;

/** Stop distance must be at least this many ATRs (avoids a mathematically useless stop). */
export const MIN_STOP_ATR_MULTIPLE = 0.25;

/** Extra distance beyond a support/resistance level when the stop is placed at that level. */
export const SR_STOP_BUFFER_ATR_MULTIPLE = 0.1;

export type RiskLevels = {
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskPerUnit: number;
  rewardPerUnit: number;
  riskReward: number;
  reasons: string[];
  invalid: "INVALID_ENTRY" | "INVALID_STOP" | "INVALID_TARGET" | "INVALID_RR" | null;
};

function nearestBelow(levels: PriceLevel[], price: number): PriceLevel | null {
  const below = levels.filter((level) => level.price < price && level.price > 0);
  if (below.length === 0) {
    return null;
  }
  return below.reduce((best, level) => (level.price > best.price ? level : best));
}

function nearestAbove(levels: PriceLevel[], price: number): PriceLevel | null {
  const above = levels.filter((level) => level.price > price);
  if (above.length === 0) {
    return null;
  }
  return above.reduce((best, level) => (level.price < best.price ? level : best));
}

function blockingLevel(
  levels: PriceLevel[],
  entry: number,
  takeProfit: number,
  direction: "LONG" | "SHORT",
): PriceLevel | null {
  const between =
    direction === "LONG"
      ? levels.filter((level) => level.price > entry && level.price < takeProfit)
      : levels.filter((level) => level.price < entry && level.price > takeProfit);
  if (between.length === 0) {
    return null;
  }
  return between.reduce((best, level) => {
    if (level.strength > best.strength) {
      return level;
    }
    if (level.strength === best.strength) {
      return Math.abs(level.price - entry) < Math.abs(best.price - entry)
        ? level
        : best;
    }
    return best;
  });
}

export function computeStopLoss(input: {
  direction: "LONG" | "SHORT";
  entry: number;
  atr: number;
  supportLevels: PriceLevel[];
  resistanceLevels: PriceLevel[];
  atrMultiplier?: number;
}): { stopLoss: number; reasons: string[]; invalid: "INVALID_STOP" | null } {
  const multiplier = input.atrMultiplier ?? ATR_STOP_MULTIPLIER;
  const { direction, entry, atr } = input;
  const reasons: string[] = [];
  if (!(entry > 0) || !(atr > 0) || !(multiplier > 0)) {
    return { stopLoss: Number.NaN, reasons, invalid: "INVALID_STOP" };
  }

  const minDistance = atr * MIN_STOP_ATR_MULTIPLE;
  const buffer = atr * SR_STOP_BUFFER_ATR_MULTIPLE;
  let stop =
    direction === "LONG"
      ? entry - atr * multiplier
      : entry + atr * multiplier;
  reasons.push(
    `ATR stop ${multiplier.toFixed(2)}× (${direction === "LONG" ? "entry − ATR" : "entry + ATR"})`,
  );

  if (direction === "LONG") {
    const support = nearestBelow(input.supportLevels, entry);
    if (support && stop > support.price) {
      const adjusted = support.price - buffer;
      if (adjusted < entry && entry - adjusted >= minDistance) {
        stop = adjusted;
        reasons.push("Stop placed below nearest support");
      } else {
        return { stopLoss: Number.NaN, reasons, invalid: "INVALID_STOP" };
      }
    }
    if (!(stop > 0) || !(stop < entry) || entry - stop < minDistance) {
      return { stopLoss: Number.NaN, reasons, invalid: "INVALID_STOP" };
    }
  } else {
    const resistance = nearestAbove(input.resistanceLevels, entry);
    if (resistance && stop < resistance.price) {
      const adjusted = resistance.price + buffer;
      if (adjusted > entry && adjusted - entry >= minDistance) {
        stop = adjusted;
        reasons.push("Stop placed above nearest resistance");
      } else {
        return { stopLoss: Number.NaN, reasons, invalid: "INVALID_STOP" };
      }
    }
    if (!(stop > entry) || stop - entry < minDistance) {
      return { stopLoss: Number.NaN, reasons, invalid: "INVALID_STOP" };
    }
  }

  return { stopLoss: stop, reasons, invalid: null };
}

export function computeRiskReward(input: {
  direction: "LONG" | "SHORT";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  minimumRiskReward: number;
}): {
  riskPerUnit: number;
  rewardPerUnit: number;
  riskReward: number;
  invalid: "INVALID_RR" | "INVALID_TARGET" | null;
} {
  const { direction, entry, stopLoss, takeProfit, minimumRiskReward } = input;
  if (!(takeProfit > 0)) {
    return {
      riskPerUnit: Number.NaN,
      rewardPerUnit: Number.NaN,
      riskReward: Number.NaN,
      invalid: "INVALID_TARGET",
    };
  }
  const riskPerUnit =
    direction === "LONG" ? entry - stopLoss : stopLoss - entry;
  const rewardPerUnit =
    direction === "LONG" ? takeProfit - entry : entry - takeProfit;
  if (!(riskPerUnit > 0) || !(rewardPerUnit > 0)) {
    return {
      riskPerUnit,
      rewardPerUnit,
      riskReward: Number.NaN,
      invalid: "INVALID_RR",
    };
  }
  const riskReward = rewardPerUnit / riskPerUnit;
  if (riskReward + 1e-10 < minimumRiskReward) {
    return { riskPerUnit, rewardPerUnit, riskReward, invalid: "INVALID_RR" };
  }
  return { riskPerUnit, rewardPerUnit, riskReward, invalid: null };
}

export function computeTakeProfit(input: {
  direction: "LONG" | "SHORT";
  entry: number;
  stopLoss: number;
  minimumRiskReward: number;
  plannedRiskReward?: number;
  supportLevels: PriceLevel[];
  resistanceLevels: PriceLevel[];
}): {
  takeProfit: number;
  riskPerUnit: number;
  rewardPerUnit: number;
  riskReward: number;
  reasons: string[];
  invalid: "INVALID_TARGET" | "INVALID_RR" | null;
} {
  const { direction, entry, stopLoss, minimumRiskReward } = input;
  const plannedRr = input.plannedRiskReward ?? minimumRiskReward;
  const reasons: string[] = [];
  const riskPerUnit =
    direction === "LONG" ? entry - stopLoss : stopLoss - entry;
  if (!(riskPerUnit > 0)) {
    return {
      takeProfit: Number.NaN,
      riskPerUnit,
      rewardPerUnit: Number.NaN,
      riskReward: Number.NaN,
      reasons,
      invalid: "INVALID_RR",
    };
  }

  let takeProfit =
    direction === "LONG"
      ? entry + riskPerUnit * plannedRr
      : entry - riskPerUnit * plannedRr;
  reasons.push(`Take profit at ${plannedRr}:1 R:R`);

  const blocker =
    direction === "LONG"
      ? blockingLevel(input.resistanceLevels, entry, takeProfit, "LONG")
      : blockingLevel(input.supportLevels, entry, takeProfit, "SHORT");

  if (blocker) {
    const rewardToLevel =
      direction === "LONG" ? blocker.price - entry : entry - blocker.price;
    const rrToLevel = rewardToLevel / riskPerUnit;
    if (rrToLevel + 1e-10 >= minimumRiskReward && rewardToLevel > 0) {
      takeProfit = blocker.price;
      reasons.push(
        direction === "LONG"
          ? "Take profit capped at nearest resistance"
          : "Take profit capped at nearest support",
      );
    } else {
      reasons.push(
        direction === "LONG"
          ? "Resistance blocks the minimum R:R"
          : "Support blocks the minimum R:R",
      );
      return {
        takeProfit: Number.NaN,
        riskPerUnit,
        rewardPerUnit: Number.NaN,
        riskReward: Number.NaN,
        reasons,
        invalid: "INVALID_RR",
      };
    }
  }

  if (!(takeProfit > 0)) {
    return {
      takeProfit,
      riskPerUnit,
      rewardPerUnit: Number.NaN,
      riskReward: Number.NaN,
      reasons,
      invalid: "INVALID_TARGET",
    };
  }

  const rr = computeRiskReward({
    direction,
    entry,
    stopLoss,
    takeProfit,
    minimumRiskReward,
  });
  return {
    takeProfit,
    riskPerUnit: rr.riskPerUnit,
    rewardPerUnit: rr.rewardPerUnit,
    riskReward: rr.riskReward,
    reasons,
    invalid: rr.invalid,
  };
}

export function buildRiskLevels(input: {
  direction: Exclude<SetupDirection, "NO_TRADE">;
  snapshot: TechnicalSnapshot;
  minimumRiskReward: number;
  atrMultiplier?: number;
}): RiskLevels {
  const entry = input.snapshot.currentPrice;
  const atr = input.snapshot.atr14;
  if (entry === null || !(entry > 0)) {
    return emptyLevels("INVALID_ENTRY");
  }
  if (atr === null || !(atr > 0)) {
    return emptyLevels("INVALID_STOP");
  }

  const stop = computeStopLoss({
    direction: input.direction,
    entry,
    atr,
    supportLevels: input.snapshot.supportLevels,
    resistanceLevels: input.snapshot.resistanceLevels,
    atrMultiplier: input.atrMultiplier,
  });
  if (stop.invalid) {
    return emptyLevels(stop.invalid, stop.reasons);
  }

  const target = computeTakeProfit({
    direction: input.direction,
    entry,
    stopLoss: stop.stopLoss,
    minimumRiskReward: input.minimumRiskReward,
    supportLevels: input.snapshot.supportLevels,
    resistanceLevels: input.snapshot.resistanceLevels,
  });
  if (target.invalid) {
    return {
      entry,
      stopLoss: stop.stopLoss,
      takeProfit: Number.NaN,
      riskPerUnit: target.riskPerUnit,
      rewardPerUnit: target.rewardPerUnit,
      riskReward: target.riskReward,
      reasons: [...stop.reasons, ...target.reasons],
      invalid: target.invalid,
    };
  }

  return {
    entry,
    stopLoss: stop.stopLoss,
    takeProfit: target.takeProfit,
    riskPerUnit: target.riskPerUnit,
    rewardPerUnit: target.rewardPerUnit,
    riskReward: target.riskReward,
    reasons: [
      ...stop.reasons,
      ...target.reasons,
      `Risk/Reward ${target.riskReward.toFixed(2)}`,
    ],
    invalid: null,
  };
}

function emptyLevels(
  invalid: RiskLevels["invalid"],
  reasons: string[] = [],
): RiskLevels {
  return {
    entry: Number.NaN,
    stopLoss: Number.NaN,
    takeProfit: Number.NaN,
    riskPerUnit: Number.NaN,
    rewardPerUnit: Number.NaN,
    riskReward: Number.NaN,
    reasons,
    invalid,
  };
}
