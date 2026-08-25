import { isFiniteNumber } from "../utils/math";

/**
 * Standard EMA.
 *
 * Initialization: the first EMA value is the SMA of the first `period` closes.
 * That seed sits at index `period - 1`. Subsequent values:
 *
 *   EMA_t = close_t * k + EMA_{t-1} * (1 - k)
 *   k = 2 / (period + 1)
 *
 * Insufficient data → null (never estimated). Full JS number precision; no rounding.
 */
export function emaMultiplier(period: number): number {
  return 2 / (period + 1);
}

export function emaSeries(
  values: readonly number[],
  period: number,
): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: values.length }, () => null);
  if (!Number.isInteger(period) || period < 1 || values.length < period) {
    return out;
  }

  let sum = 0;
  for (let i = 0; i < period; i += 1) {
    const value = values[i];
    if (!isFiniteNumber(value)) {
      return out;
    }
    sum += value;
  }

  let ema = sum / period;
  out[period - 1] = ema;
  const k = emaMultiplier(period);
  const oneMinus = 1 - k;

  for (let i = period; i < values.length; i += 1) {
    const value = values[i];
    if (!isFiniteNumber(value)) {
      break;
    }
    ema = value * k + ema * oneMinus;
    out[i] = ema;
  }

  return out;
}

export function emaLast(values: readonly number[], period: number): number | null {
  const series = emaSeries(values, period);
  const last = series[series.length - 1];
  return last === undefined ? null : last;
}

export const EMA_PERIODS = {
  ema20: 20,
  ema50: 50,
  ema200: 200,
} as const;
