import type { PaperEquityPoint } from "./types";

export function buildPaperEquityCurve(input: {
  startingBalance: number;
  closedTrades: Array<{
    closedAt: string | null;
    pnl: number | null;
  }>;
}): PaperEquityPoint[] {
  const chronological = [...input.closedTrades]
    .filter((trade) => trade.closedAt && trade.pnl !== null)
    .sort(
      (a, b) =>
        Date.parse(a.closedAt!) - Date.parse(b.closedAt!),
    );

  if (chronological.length === 0) {
    return [];
  }

  let equity = input.startingBalance;
  let peak = equity;
  const points: PaperEquityPoint[] = [];

  for (const trade of chronological) {
    equity += trade.pnl!;
    peak = Math.max(peak, equity);
    const drawdown = peak > 0 ? (peak - equity) / peak : 0;
    points.push({
      timestamp: trade.closedAt!,
      equity,
      drawdown,
    });
  }

  return points;
}

export function computeMaxDrawdownFromCurve(
  points: readonly PaperEquityPoint[],
): number | null {
  if (points.length === 0) {
    return null;
  }
  let peak = points[0]!.equity;
  let maxDrawdown = 0;
  for (const point of points) {
    peak = Math.max(peak, point.equity);
    if (peak > 0) {
      maxDrawdown = Math.max(maxDrawdown, (peak - point.equity) / peak);
    }
  }
  return maxDrawdown;
}

export function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function sum(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((total, value) => total + value, 0);
}

export function winRate(wins: number, total: number): number | null {
  if (total === 0) {
    return null;
  }
  return wins / total;
}

export function profitFactor(
  grossProfit: number,
  grossLoss: number,
): number | null {
  if (grossLoss === 0) {
    return null;
  }
  return grossProfit / Math.abs(grossLoss);
}
