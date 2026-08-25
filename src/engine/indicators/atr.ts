import { isFiniteNumber, wilderSmooth } from "../utils/math";
import type { OhlcvBar } from "../utils/validation";

export const ATR_PERIOD = 14;

/**
 * True Range for a bar. When previousClose is missing, TR is undefined
 * (the spec formula requires previous close). Never estimated.
 */
export function trueRange(
  high: number,
  low: number,
  previousClose: number,
): number {
  return Math.max(
    high - low,
    Math.abs(high - previousClose),
    Math.abs(low - previousClose),
  );
}

/**
 * Wilder ATR.
 *
 * TR starts at index 1 (needs previous close). First ATR is the SMA of the first
 * `period` true ranges (at candle index `period`). Then Wilder smoothing.
 * Requires `period + 1` candles. Insufficient data → null.
 */
export function atrSeries(
  bars: readonly Pick<OhlcvBar, "high" | "low" | "close">[],
  period: number = ATR_PERIOD,
): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: bars.length }, () => null);
  if (!Number.isInteger(period) || period < 1 || bars.length < period + 1) {
    return out;
  }

  const trs: number[] = [];
  const trIndex: number[] = [];
  for (let i = 1; i < bars.length; i += 1) {
    const current = bars[i];
    const previous = bars[i - 1];
    if (
      !current ||
      !previous ||
      !isFiniteNumber(current.high) ||
      !isFiniteNumber(current.low) ||
      !isFiniteNumber(previous.close)
    ) {
      return out;
    }
    trs.push(trueRange(current.high, current.low, previous.close));
    trIndex.push(i);
  }

  const smoothed = wilderSmooth(trs, period);
  for (let j = 0; j < smoothed.length; j += 1) {
    const index = trIndex[j];
    if (index !== undefined) {
      out[index] = smoothed[j] ?? null;
    }
  }
  return out;
}

export function atrLast(
  bars: readonly Pick<OhlcvBar, "high" | "low" | "close">[],
  period: number = ATR_PERIOD,
): number | null {
  const series = atrSeries(bars, period);
  const last = series[series.length - 1];
  return last === undefined ? null : last;
}
