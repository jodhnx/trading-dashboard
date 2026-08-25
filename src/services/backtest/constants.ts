/** Minimum bars before EMA200 is meaningful — matches engine warmup. */
export const BACKTEST_WARMUP_BARS = 200;

/** Maximum candles fetched/processed in one backtest run. */
export const BACKTEST_MAX_CANDLES = 1000;

/** Maximum calendar span for a backtest request (days). */
export const BACKTEST_MAX_RANGE_DAYS = 730;

export const BACKTEST_MIN_STARTING_CAPITAL = 100;
export const BACKTEST_MAX_STARTING_CAPITAL = 100_000_000;

/** Commission and slippage are not modeled in Phase 14. */
export const BACKTEST_COMMISSION = 0;
export const BACKTEST_SLIPPAGE = 0;
