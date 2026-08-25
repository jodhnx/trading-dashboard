import type { PositionSide } from "@/types/enums";
import type { BacktestExitReason } from "./types";

export type BarExitEvaluation = {
  exitReason: BacktestExitReason;
  exitPrice: number;
};

/**
 * Evaluate stop/target on a single OHLC bar.
 *
 * Conservative rule: if both stop and target are touched in the same bar,
 * STOP LOSS wins (never pick the more favorable outcome).
 */
export function evaluateBarExit(input: {
  side: PositionSide;
  stopLoss: number;
  takeProfit: number;
  high: number;
  low: number;
}): BarExitEvaluation | null {
  if (input.side === "LONG") {
    const stopHit = input.low <= input.stopLoss;
    const targetHit = input.high >= input.takeProfit;
    if (stopHit && targetHit) {
      return { exitReason: "STOP_LOSS", exitPrice: input.stopLoss };
    }
    if (stopHit) {
      return { exitReason: "STOP_LOSS", exitPrice: input.stopLoss };
    }
    if (targetHit) {
      return { exitReason: "TAKE_PROFIT", exitPrice: input.takeProfit };
    }
    return null;
  }

  const stopHit = input.high >= input.stopLoss;
  const targetHit = input.low <= input.takeProfit;
  if (stopHit && targetHit) {
    return { exitReason: "STOP_LOSS", exitPrice: input.stopLoss };
  }
  if (stopHit) {
    return { exitReason: "STOP_LOSS", exitPrice: input.stopLoss };
  }
  if (targetHit) {
    return { exitReason: "TAKE_PROFIT", exitPrice: input.takeProfit };
  }
  return null;
}

export function markToMarket(input: {
  quantity: number;
  markPrice: number;
}): number {
  return input.markPrice * input.quantity;
}

export function unrealizedPnL(input: {
  side: PositionSide;
  entryPrice: number;
  quantity: number;
  markPrice: number;
}): number {
  if (input.side === "LONG") {
    return (input.markPrice - input.entryPrice) * input.quantity;
  }
  return (input.entryPrice - input.markPrice) * input.quantity;
}

export function realizedPnL(input: {
  side: PositionSide;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
}): number {
  if (input.side === "LONG") {
    return (input.exitPrice - input.entryPrice) * input.quantity;
  }
  return (input.entryPrice - input.exitPrice) * input.quantity;
}

export function realizedPnLPercent(input: {
  side: PositionSide;
  entryPrice: number;
  exitPrice: number;
}): number | null {
  if (!(input.entryPrice > 0)) {
    return null;
  }
  if (input.side === "LONG") {
    return ((input.exitPrice - input.entryPrice) / input.entryPrice) * 100;
  }
  return ((input.entryPrice - input.exitPrice) / input.entryPrice) * 100;
}

export function cashAfterClose(input: {
  cashBalance: number;
  entryPrice: number;
  quantity: number;
  exitPrice: number;
  side: PositionSide;
}): number {
  const pnl = realizedPnL({
    side: input.side,
    entryPrice: input.entryPrice,
    exitPrice: input.exitPrice,
    quantity: input.quantity,
  });
  return input.cashBalance + input.entryPrice * input.quantity + pnl;
}

export function cashAfterOpen(input: {
  cashBalance: number;
  entryPrice: number;
  quantity: number;
}): number {
  return input.cashBalance - input.entryPrice * input.quantity;
}
