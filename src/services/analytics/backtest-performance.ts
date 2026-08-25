import type { BacktestRunRow } from "@/types/database";
import type { BacktestAnalyticsSection, BacktestRunSummary } from "./types";

function mapBacktestRun(row: BacktestRunRow, symbol: string | null): BacktestRunSummary {
  const initial = row.initial_capital === null ? null : Number(row.initial_capital);
  const finalCapital = row.final_capital === null ? null : Number(row.final_capital);
  const totalReturn =
    initial !== null && finalCapital !== null && initial > 0
      ? (finalCapital - initial) / initial
      : null;

  return {
    id: row.id,
    symbol,
    timeframe: row.timeframe,
    from: row.start_date,
    to: row.end_date,
    totalReturn,
    totalTrades: row.total_trades === null ? null : Number(row.total_trades),
    winRate: row.win_rate === null ? null : Number(row.win_rate),
    maxDrawdown: row.max_drawdown === null ? null : Number(row.max_drawdown),
    profitFactor: row.profit_factor === null ? null : Number(row.profit_factor),
    status: row.status,
    createdAt: row.created_at,
  };
}

export function buildBacktestAnalyticsSection(input: {
  runs: Array<{ row: BacktestRunRow; symbol: string | null }>;
}): BacktestAnalyticsSection {
  const runs = input.runs.map((item) => mapBacktestRun(item.row, item.symbol));
  return {
    hasSavedResults: runs.length > 0,
    runs,
  };
}
