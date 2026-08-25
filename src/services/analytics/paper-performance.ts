import type { StoredPaperTrade } from "@/services/paper/types";
import { unrealizedPnL as computeUnrealizedPnL } from "@/services/paper/calculations";
import { SCORE_BUCKETS } from "./constants";
import type {
  AssetPerformanceRow,
  ExitReasonRow,
  PaperPerformanceSummary,
  ScoreBucketRow,
  SidePerformanceRow,
} from "./types";
import {
  average,
  buildPaperEquityCurve,
  computeMaxDrawdownFromCurve,
  profitFactor,
  sum,
  winRate,
} from "./drawdown";

export type StoredOpenPosition = {
  symbol: string;
  side: StoredPaperTrade["side"];
  quantity: number;
  entryPrice: number;
  currentPrice: number | null;
};

export type AnalyticsPaperTrade = StoredPaperTrade;

function tradesWithPnL(trades: AnalyticsPaperTrade[]): AnalyticsPaperTrade[] {
  return trades.filter((trade) => trade.pnl !== null);
}

function computeAverageRiskReward(trades: AnalyticsPaperTrade[]): number | null {
  const values = trades
    .map((trade) => {
      if (trade.pnl === null || trade.riskAmount === null || !(trade.riskAmount > 0)) {
        return null;
      }
      return trade.pnl / trade.riskAmount;
    })
    .filter((value): value is number => value !== null);
  return average(values);
}

export function computePaperPerformanceSummary(input: {
  startingBalance: number;
  cash: number;
  closedTrades: AnalyticsPaperTrade[];
  openPositions: StoredOpenPosition[];
}): PaperPerformanceSummary {
  const closed = tradesWithPnL(input.closedTrades);
  const wins = closed.filter((trade) => (trade.pnl ?? 0) > 0);
  const losses = closed.filter((trade) => (trade.pnl ?? 0) < 0);
  const realizedValues = closed.map((trade) => trade.pnl!);
  const realizedPnL = sum(realizedValues);
  const grossProfit = sum(wins.map((trade) => trade.pnl!)) ?? 0;
  const grossLoss = sum(losses.map((trade) => trade.pnl!)) ?? 0;

  const unrealizedValues: Array<number | null> = input.openPositions.map((position) => {
    if (position.currentPrice === null) {
      return null;
    }
    return computeUnrealizedPnL({
      side: position.side,
      entryPrice: position.entryPrice,
      currentPrice: position.currentPrice,
      quantity: position.quantity,
    });
  });

  const totalUnrealizedPnL: number | null =
    input.openPositions.length === 0
      ? 0
      : unrealizedValues.some((value) => value === null)
        ? null
        : unrealizedValues.reduce<number>((total, value) => total + (value ?? 0), 0);

  const investedAtMark: Array<number | null> = input.openPositions.map((position) => {
    if (position.currentPrice === null) {
      return null;
    }
    return position.currentPrice * position.quantity;
  });
  const investedTotal = investedAtMark.reduce<number>(
    (total, value) => total + (value ?? 0),
    0,
  );
  const equity: number | null =
    totalUnrealizedPnL === null && input.openPositions.length > 0
      ? null
      : input.cash + investedTotal;

  const totalReturn =
    equity !== null && input.startingBalance > 0
      ? (equity - input.startingBalance) / input.startingBalance
      : realizedPnL !== null && input.startingBalance > 0 && input.openPositions.length === 0
        ? realizedPnL / input.startingBalance
        : null;

  const equityCurve = buildPaperEquityCurve({
    startingBalance: input.startingBalance,
    closedTrades: closed.map((trade) => ({
      closedAt: trade.closedAt,
      pnl: trade.pnl,
    })),
  });

  return {
    startingBalance: input.startingBalance,
    cash: input.cash,
    equity,
    realizedPnL,
    unrealizedPnL: totalUnrealizedPnL,
    totalReturn,
    totalTrades: closed.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: winRate(wins.length, closed.length),
    averageWinningTrade: average(wins.map((trade) => trade.pnl!)),
    averageLosingTrade: average(losses.map((trade) => trade.pnl!)),
    averageTrade: average(realizedValues),
    largestWinner:
      wins.length === 0 ? null : Math.max(...wins.map((trade) => trade.pnl!)),
    largestLoser:
      losses.length === 0 ? null : Math.min(...losses.map((trade) => trade.pnl!)),
    grossProfit: wins.length === 0 ? null : grossProfit,
    grossLoss: losses.length === 0 ? null : grossLoss,
    profitFactor:
      wins.length === 0 || losses.length === 0
        ? null
        : profitFactor(grossProfit, grossLoss),
    maxDrawdown: computeMaxDrawdownFromCurve(equityCurve),
    averageRiskReward: computeAverageRiskReward(closed),
  };
}

function aggregateTradeRows(trades: AnalyticsPaperTrade[]): Omit<
  AssetPerformanceRow,
  "symbol"
> {
  const closed = tradesWithPnL(trades);
  const wins = closed.filter((trade) => (trade.pnl ?? 0) > 0);
  const losses = closed.filter((trade) => (trade.pnl ?? 0) < 0);
  const pnls = closed.map((trade) => trade.pnl!);
  return {
    trades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: winRate(wins.length, closed.length),
    totalPnL: sum(pnls),
    averagePnL: average(pnls),
    largestWin:
      wins.length === 0 ? null : Math.max(...wins.map((trade) => trade.pnl!)),
    largestLoss:
      losses.length === 0 ? null : Math.min(...losses.map((trade) => trade.pnl!)),
    averageRiskReward: computeAverageRiskReward(closed),
  };
}

export function groupPaperTradesByAsset(
  trades: AnalyticsPaperTrade[],
): AssetPerformanceRow[] {
  const groups = new Map<string, AnalyticsPaperTrade[]>();
  for (const trade of trades) {
    const list = groups.get(trade.symbol) ?? [];
    list.push(trade);
    groups.set(trade.symbol, list);
  }
  return [...groups.entries()]
    .map(([symbol, grouped]) => ({
      symbol,
      ...aggregateTradeRows(grouped),
    }))
    .sort((a, b) => (b.totalPnL ?? 0) - (a.totalPnL ?? 0));
}

export function groupPaperTradesBySide(
  trades: AnalyticsPaperTrade[],
): SidePerformanceRow[] {
  const sides: Array<SidePerformanceRow["side"]> = ["LONG", "SHORT"];
  return sides.map((side) => {
    const grouped = trades.filter((trade) => trade.side === side);
    const closed = tradesWithPnL(grouped);
    const wins = closed.filter((trade) => (trade.pnl ?? 0) > 0);
    const losses = closed.filter((trade) => (trade.pnl ?? 0) < 0);
    const pnls = closed.map((trade) => trade.pnl!);
    return {
      side,
      trades: closed.length,
      wins: wins.length,
      losses: losses.length,
      winRate: winRate(wins.length, closed.length),
      totalPnL: sum(pnls),
      averagePnL: average(pnls),
    };
  });
}

export function groupPaperTradesByScore(
  trades: AnalyticsPaperTrade[],
): ScoreBucketRow[] {
  return SCORE_BUCKETS.map((bucket) => {
    const grouped = trades.filter((trade) => {
      if (trade.setupScore === null) {
        return false;
      }
      return trade.setupScore >= bucket.min && trade.setupScore <= bucket.max;
    });
    const closed = tradesWithPnL(grouped);
    const wins = closed.filter((trade) => (trade.pnl ?? 0) > 0);
    const pnls = closed.map((trade) => trade.pnl!);
    return {
      bucket: bucket.label,
      trades: closed.length,
      winRate: winRate(wins.length, closed.length),
      totalPnL: sum(pnls),
      averagePnL: average(pnls),
      insufficientData: closed.length === 0,
    };
  });
}

export function groupPaperTradesByExitReason(
  trades: AnalyticsPaperTrade[],
): ExitReasonRow[] {
  const reasons: Array<NonNullable<AnalyticsPaperTrade["closeReason"]>> = [
    "MANUAL",
    "STOP_LOSS",
    "TAKE_PROFIT",
  ];
  return reasons.map((reason) => {
    const grouped = trades.filter((trade) => trade.closeReason === reason);
    const closed = tradesWithPnL(grouped);
    const pnls = closed.map((trade) => trade.pnl!);
    return {
      reason,
      count: closed.length,
      totalPnL: sum(pnls),
      averagePnL: average(pnls),
    };
  });
}

export {
  buildPaperEquityCurve,
  computeMaxDrawdownFromCurve,
};
