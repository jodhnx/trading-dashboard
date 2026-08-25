import type { BacktestResult, BacktestTrade, EquityPoint } from "./types";

export function computeMaxDrawdown(equityCurve: readonly EquityPoint[]): number {
  if (equityCurve.length === 0) {
    return 0;
  }
  let peak = equityCurve[0]!.equity;
  let maxDrawdown = 0;
  for (const point of equityCurve) {
    peak = Math.max(peak, point.equity);
    if (peak > 0) {
      maxDrawdown = Math.max(maxDrawdown, (peak - point.equity) / peak);
    }
  }
  return maxDrawdown;
}

export function computeWinRate(trades: readonly BacktestTrade[]): number | null {
  if (trades.length === 0) {
    return null;
  }
  const wins = trades.filter((trade) => trade.realizedPnL > 0).length;
  return wins / trades.length;
}

export function computeProfitFactor(
  trades: readonly BacktestTrade[],
): number | null {
  const grossProfit = trades
    .filter((trade) => trade.realizedPnL > 0)
    .reduce((sum, trade) => sum + trade.realizedPnL, 0);
  const grossLoss = trades
    .filter((trade) => trade.realizedPnL < 0)
    .reduce((sum, trade) => sum + Math.abs(trade.realizedPnL), 0);
  if (grossLoss === 0) {
    return null;
  }
  return grossProfit / grossLoss;
}

export function computeAverageTradePnL(
  trades: readonly BacktestTrade[],
): number | null {
  if (trades.length === 0) {
    return null;
  }
  const total = trades.reduce((sum, trade) => sum + trade.realizedPnL, 0);
  return total / trades.length;
}

export function computeAverageRiskReward(
  trades: readonly BacktestTrade[],
): number | null {
  const values = trades
    .map((trade) => {
      const risk = Math.abs(trade.entryPrice - trade.stopLoss) * trade.quantity;
      if (!(risk > 0)) {
        return null;
      }
      return trade.realizedPnL / risk;
    })
    .filter((value): value is number => value !== null);
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildBacktestResult(input: {
  symbol: string;
  timeframe: BacktestResult["timeframe"];
  from: string;
  to: string;
  startingCapital: number;
  endingCapital: number;
  dataStatus: BacktestResult["dataStatus"];
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
}): BacktestResult {
  const totalPnL = input.endingCapital - input.startingCapital;
  const totalReturn =
    input.startingCapital > 0 ? totalPnL / input.startingCapital : 0;
  const winningTrades = input.trades.filter(
    (trade) => trade.realizedPnL > 0,
  ).length;
  const losingTrades = input.trades.filter(
    (trade) => trade.realizedPnL < 0,
  ).length;

  return {
    symbol: input.symbol,
    timeframe: input.timeframe,
    from: input.from,
    to: input.to,
    startingCapital: input.startingCapital,
    endingCapital: input.endingCapital,
    totalReturn,
    totalPnL,
    totalTrades: input.trades.length,
    winningTrades,
    losingTrades,
    winRate: computeWinRate(input.trades),
    averageTradePnL: computeAverageTradePnL(input.trades),
    maxDrawdown: computeMaxDrawdown(input.equityCurve),
    profitFactor: computeProfitFactor(input.trades),
    averageRiskReward: computeAverageRiskReward(input.trades),
    dataStatus: input.dataStatus,
    feesSlippageModeled: false,
    trades: input.trades,
    equityCurve: input.equityCurve,
  };
}
