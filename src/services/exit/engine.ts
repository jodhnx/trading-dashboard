import type { PositionSide } from "@/types/enums";

export const EXIT_STATES = [
  "HOLD",
  "HOLD_STRONG",
  "TAKE_PROFIT",
  "PARTIAL_TAKE_PROFIT",
  "EXIT",
  "STOP_LOSS",
  "THESIS_INVALIDATED",
  "WATCH",
] as const;
export type ExitState = (typeof EXIT_STATES)[number];

export type ExitEvaluation = {
  state: ExitState;
  urgency: "URGENT_EXIT" | "TAKE_PROFIT" | "WATCH" | "HOLD";
  reasons: string[];
  unrealizedPnLPercent: number | null;
  distanceToStopPercent: number | null;
  distanceToTargetPercent: number | null;
  trailingStop: number | null;
};

function pnlPercent(input: {
  side: PositionSide;
  entry: number;
  current: number;
}): number | null {
  if (!(input.entry > 0)) return null;
  if (input.side === "LONG") {
    return ((input.current - input.entry) / input.entry) * 100;
  }
  return ((input.entry - input.current) / input.entry) * 100;
}

function pctDistance(from: number, to: number): number {
  if (!(from > 0)) return 0;
  return (Math.abs(to - from) / from) * 100;
}

/**
 * Deterministic exit engine. AI may explain this result — it must not invent it.
 */
export function evaluateExitState(input: {
  side: PositionSide;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  takeProfit2?: number | null;
  highestPriceSinceEntry?: number | null;
  lowestPriceSinceEntry?: number | null;
  trend?: string | null;
  momentum?: string | null;
  volumeTrend?: string | null;
  thesisInvalidated?: boolean;
  severeNegativeCatalyst?: boolean;
  marketRegime?: string | null;
}): ExitEvaluation {
  const {
    side,
    entryPrice,
    currentPrice,
    stopLoss,
    takeProfit,
    takeProfit2 = null,
  } = input;

  const unrealized = pnlPercent({
    side,
    entry: entryPrice,
    current: currentPrice,
  });
  const reasons: string[] = [];

  const high =
    input.highestPriceSinceEntry ??
    (side === "LONG" ? Math.max(entryPrice, currentPrice) : null);
  const low =
    input.lowestPriceSinceEntry ??
    (side === "SHORT" ? Math.min(entryPrice, currentPrice) : null);

  let trailingStop: number | null = null;
  if (side === "LONG" && high !== null && stopLoss !== null) {
    const trail = high - (high - entryPrice) * 0.4;
    trailingStop = Math.max(stopLoss, trail);
  }
  if (side === "SHORT" && low !== null && stopLoss !== null) {
    const trail = low + (entryPrice - low) * 0.4;
    trailingStop = Math.min(stopLoss, trail);
  }

  // Hard stops first
  if (stopLoss !== null) {
    if (side === "LONG" && currentPrice <= stopLoss) {
      return {
        state: "STOP_LOSS",
        urgency: "URGENT_EXIT",
        reasons: ["Stop-loss level reached"],
        unrealizedPnLPercent: unrealized,
        distanceToStopPercent: 0,
        distanceToTargetPercent:
          takeProfit !== null ? pctDistance(currentPrice, takeProfit) : null,
        trailingStop,
      };
    }
    if (side === "SHORT" && currentPrice >= stopLoss) {
      return {
        state: "STOP_LOSS",
        urgency: "URGENT_EXIT",
        reasons: ["Stop-loss level reached"],
        unrealizedPnLPercent: unrealized,
        distanceToStopPercent: 0,
        distanceToTargetPercent:
          takeProfit !== null ? pctDistance(currentPrice, takeProfit) : null,
        trailingStop,
      };
    }
  }

  if (input.thesisInvalidated) {
    return {
      state: "THESIS_INVALIDATED",
      urgency: "URGENT_EXIT",
      reasons: ["Thesis invalidated by technical or news evidence"],
      unrealizedPnLPercent: unrealized,
      distanceToStopPercent:
        stopLoss !== null ? pctDistance(currentPrice, stopLoss) : null,
      distanceToTargetPercent:
        takeProfit !== null ? pctDistance(currentPrice, takeProfit) : null,
      trailingStop,
    };
  }

  if (input.severeNegativeCatalyst) {
    return {
      state: "EXIT",
      urgency: "URGENT_EXIT",
      reasons: ["Severe negative catalyst"],
      unrealizedPnLPercent: unrealized,
      distanceToStopPercent:
        stopLoss !== null ? pctDistance(currentPrice, stopLoss) : null,
      distanceToTargetPercent:
        takeProfit !== null ? pctDistance(currentPrice, takeProfit) : null,
      trailingStop,
    };
  }

  // Targets
  if (takeProfit !== null) {
    const hitTp1 =
      side === "LONG"
        ? currentPrice >= takeProfit
        : currentPrice <= takeProfit;
    if (hitTp1) {
      const hitTp2 =
        takeProfit2 !== null &&
        (side === "LONG"
          ? currentPrice >= takeProfit2
          : currentPrice <= takeProfit2);
      if (hitTp2) {
        return {
          state: "TAKE_PROFIT",
          urgency: "TAKE_PROFIT",
          reasons: ["Take-profit 2 reached"],
          unrealizedPnLPercent: unrealized,
          distanceToStopPercent:
            stopLoss !== null ? pctDistance(currentPrice, stopLoss) : null,
          distanceToTargetPercent: 0,
          trailingStop,
        };
      }
      return {
        state: "PARTIAL_TAKE_PROFIT",
        urgency: "TAKE_PROFIT",
        reasons: ["Take-profit 1 reached — consider partial profits"],
        unrealizedPnLPercent: unrealized,
        distanceToStopPercent:
          stopLoss !== null ? pctDistance(currentPrice, stopLoss) : null,
        distanceToTargetPercent:
          takeProfit2 !== null ? pctDistance(currentPrice, takeProfit2) : 0,
        trailingStop,
      };
    }
  }

  // Trailing stop breach
  if (trailingStop !== null) {
    if (side === "LONG" && currentPrice <= trailingStop && unrealized !== null && unrealized > 0) {
      return {
        state: "EXIT",
        urgency: "TAKE_PROFIT",
        reasons: ["Trailing stop triggered after unrealized gains"],
        unrealizedPnLPercent: unrealized,
        distanceToStopPercent: pctDistance(currentPrice, trailingStop),
        distanceToTargetPercent:
          takeProfit !== null ? pctDistance(currentPrice, takeProfit) : null,
        trailingStop,
      };
    }
    if (side === "SHORT" && currentPrice >= trailingStop && unrealized !== null && unrealized > 0) {
      return {
        state: "EXIT",
        urgency: "TAKE_PROFIT",
        reasons: ["Trailing stop triggered after unrealized gains"],
        unrealizedPnLPercent: unrealized,
        distanceToStopPercent: pctDistance(currentPrice, trailingStop),
        distanceToTargetPercent:
          takeProfit !== null ? pctDistance(currentPrice, takeProfit) : null,
        trailingStop,
      };
    }
  }

  // Momentum / structure deterioration
  if (
    (side === "LONG" &&
      (input.trend === "BEARISH" ||
        input.momentum === "NEGATIVE" ||
        input.momentum === "WEAK")) ||
    (side === "SHORT" &&
      (input.trend === "BULLISH" ||
        input.momentum === "POSITIVE" ||
        input.momentum === "STRONG"))
  ) {
    reasons.push("Momentum or trend deteriorating vs position side");
    return {
      state: "WATCH",
      urgency: "WATCH",
      reasons,
      unrealizedPnLPercent: unrealized,
      distanceToStopPercent:
        stopLoss !== null ? pctDistance(currentPrice, stopLoss) : null,
      distanceToTargetPercent:
        takeProfit !== null ? pctDistance(currentPrice, takeProfit) : null,
      trailingStop,
    };
  }

  if (input.volumeTrend === "DECREASING") {
    reasons.push("Volume deteriorating");
  }

  if (
    unrealized !== null &&
    unrealized > 3 &&
    ((side === "LONG" &&
      (input.trend === "BULLISH" || input.momentum === "POSITIVE" || input.momentum === "STRONG")) ||
      (side === "SHORT" &&
        (input.trend === "BEARISH" ||
          input.momentum === "NEGATIVE" ||
          input.momentum === "WEAK")))
  ) {
    return {
      state: "HOLD_STRONG",
      urgency: "HOLD",
      reasons: ["Unrealized gains with trend/momentum still aligned", ...reasons],
      unrealizedPnLPercent: unrealized,
      distanceToStopPercent:
        stopLoss !== null ? pctDistance(currentPrice, stopLoss) : null,
      distanceToTargetPercent:
        takeProfit !== null ? pctDistance(currentPrice, takeProfit) : null,
      trailingStop,
    };
  }

  return {
    state: "HOLD",
    urgency: "HOLD",
    reasons: reasons.length > 0 ? reasons : ["No exit trigger — thesis still intact"],
    unrealizedPnLPercent: unrealized,
    distanceToStopPercent:
      stopLoss !== null ? pctDistance(currentPrice, stopLoss) : null,
    distanceToTargetPercent:
      takeProfit !== null ? pctDistance(currentPrice, takeProfit) : null,
    trailingStop,
  };
}
