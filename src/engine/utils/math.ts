export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function mean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  let sum = 0;
  for (const value of values) {
    if (!isFiniteNumber(value)) {
      return null;
    }
    sum += value;
  }
  return sum / values.length;
}

export function lastDefined<T>(values: readonly T[]): T | undefined {
  return values.length === 0 ? undefined : values[values.length - 1];
}

export function lastFinite(values: readonly (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const value = values[i];
    if (value !== null && isFiniteNumber(value)) {
      return value;
    }
  }
  return null;
}

/**
 * Wilder smoothing: first value is SMA(period), then
 * prev * (period - 1) / period + current / period.
 * Used for RSI and ATR. This is not the standard EMA multiplier.
 */
export function wilderSmooth(
  values: readonly number[],
  period: number,
): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: values.length }, () => null);
  if (!Number.isInteger(period) || period < 1 || values.length < period) {
    return out;
  }

  let avg = 0;
  for (let i = 0; i < period; i += 1) {
    const value = values[i];
    if (!isFiniteNumber(value)) {
      return out;
    }
    avg += value;
  }
  avg /= period;
  out[period - 1] = avg;

  for (let i = period; i < values.length; i += 1) {
    const value = values[i];
    if (!isFiniteNumber(value)) {
      break;
    }
    avg = (avg * (period - 1) + value) / period;
    out[i] = avg;
  }

  return out;
}

export function maxNumber(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  let max = values[0];
  if (!isFiniteNumber(max)) {
    return null;
  }
  for (let i = 1; i < values.length; i += 1) {
    const value = values[i];
    if (!isFiniteNumber(value)) {
      return null;
    }
    if (value > max) {
      max = value;
    }
  }
  return max;
}
