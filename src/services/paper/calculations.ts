import type { PositionSide } from "@/types/enums";
import type { PaperCloseReason } from "@/types/database";

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

export function unrealizedPnL(input: {
  side: PositionSide;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
}): number {
  return realizedPnL({
    side: input.side,
    entryPrice: input.entryPrice,
    exitPrice: input.currentPrice,
    quantity: input.quantity,
  });
}

export function marketValue(currentPrice: number, quantity: number): number {
  return currentPrice * quantity;
}

export function evaluateExitTrigger(input: {
  side: PositionSide;
  stopLoss: number;
  takeProfit: number;
  currentPrice: number;
}): PaperCloseReason | null {
  if (input.side === "LONG") {
    if (input.currentPrice <= input.stopLoss) {
      return "STOP_LOSS";
    }
    if (input.currentPrice >= input.takeProfit) {
      return "TAKE_PROFIT";
    }
    return null;
  }
  if (input.currentPrice >= input.stopLoss) {
    return "STOP_LOSS";
  }
  if (input.currentPrice <= input.takeProfit) {
    return "TAKE_PROFIT";
  }
  return null;
}

export function cashAfterClose(input: {
  cashBalance: number;
  entryPrice: number;
  quantity: number;
  realizedPnL: number;
}): number {
  return input.cashBalance + input.entryPrice * input.quantity + input.realizedPnL;
}

export function aggregateEquity(input: {
  cashBalance: number;
  openMarketValues: Array<number | null>;
}): {
  invested: number | null;
  equity: number | null;
} {
  const values = input.openMarketValues;
  if (values.some((value) => value === null)) {
    return { invested: null, equity: null };
  }
  const invested = values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  return {
    invested,
    equity: input.cashBalance + invested,
  };
}

export function isUsableQuotePrice(
  price: number | null | undefined,
  status: string,
): boolean {
  return (
    price !== null &&
    price !== undefined &&
    Number.isFinite(price) &&
    price > 0 &&
    (status === "LIVE" || status === "CACHED")
  );
}
