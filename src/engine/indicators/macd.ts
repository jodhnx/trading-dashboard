import { emaSeries } from "./ema";

export const MACD_FAST_PERIOD = 12;
export const MACD_SLOW_PERIOD = 26;
export const MACD_SIGNAL_PERIOD = 9;

export type MacdPoint = {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
};

/**
 * MACD = EMA(fast) − EMA(slow). Signal = EMA of the MACD line.
 * Histogram = macd − signal.
 *
 * First MACD value appears when the slow EMA is defined (index slowPeriod − 1).
 * First signal value appears after `signalPeriod` MACD observations.
 * Insufficient data → nulls. Histogram is never estimated from a missing side.
 */
export function macdSeries(
  closes: readonly number[],
  fastPeriod: number = MACD_FAST_PERIOD,
  slowPeriod: number = MACD_SLOW_PERIOD,
  signalPeriod: number = MACD_SIGNAL_PERIOD,
): MacdPoint[] {
  const empty: MacdPoint[] = closes.map(() => ({
    macd: null,
    signal: null,
    histogram: null,
  }));
  if (closes.length === 0 || slowPeriod < fastPeriod) {
    return empty;
  }

  const fast = emaSeries(closes, fastPeriod);
  const slow = emaSeries(closes, slowPeriod);
  const macdLine: (number | null)[] = closes.map((_, i) => {
    const a = fast[i];
    const b = slow[i];
    if (a === null || b === null) {
      return null;
    }
    return a - b;
  });

  const signalLine = emaOnSparse(macdLine, signalPeriod);

  return macdLine.map((macd, i) => {
    const signal = signalLine[i] ?? null;
    const histogram = macd !== null && signal !== null ? macd - signal : null;
    return { macd, signal, histogram };
  });
}

export function macdLast(
  closes: readonly number[],
  fastPeriod: number = MACD_FAST_PERIOD,
  slowPeriod: number = MACD_SLOW_PERIOD,
  signalPeriod: number = MACD_SIGNAL_PERIOD,
): MacdPoint {
  const series = macdSeries(closes, fastPeriod, slowPeriod, signalPeriod);
  return (
    series[series.length - 1] ?? {
      macd: null,
      signal: null,
      histogram: null,
    }
  );
}

function emaOnSparse(
  series: readonly (number | null)[],
  period: number,
): (number | null)[] {
  const compact: number[] = [];
  const indexMap: number[] = [];
  for (let i = 0; i < series.length; i += 1) {
    const value = series[i];
    if (value !== null) {
      compact.push(value);
      indexMap.push(i);
    }
  }
  const smoothed = emaSeries(compact, period);
  const out: (number | null)[] = Array.from({ length: series.length }, () => null);
  for (let j = 0; j < smoothed.length; j += 1) {
    const index = indexMap[j];
    if (index !== undefined) {
      out[index] = smoothed[j] ?? null;
    }
  }
  return out;
}
