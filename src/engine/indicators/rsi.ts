import { isFiniteNumber, wilderSmooth } from "../utils/math";

export const RSI_PERIOD = 14;

/**
 * Wilder RSI.
 *
 * Requires `period + 1` closes (period price changes). First average gain/loss is
 * the SMA of those first `period` changes. Then Wilder smoothing:
 *
 *   avg = (prev * (period - 1) + current) / period
 *   RS  = avgGain / avgLoss
 *   RSI = 100 - 100 / (1 + RS)
 *
 * Edge cases (mathematically required, not clamps):
 * - avgLoss === 0 and avgGain === 0 → 50 (no directional movement)
 * - avgLoss === 0 and avgGain > 0 → 100
 * - avgGain === 0 and avgLoss > 0 → 0
 *
 * Insufficient data → null.
 */
export function rsiSeries(
  closes: readonly number[],
  period: number = RSI_PERIOD,
): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: closes.length }, () => null);
  if (!Number.isInteger(period) || period < 1 || closes.length < period + 1) {
    return out;
  }

  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    const prev = closes[i - 1];
    const current = closes[i];
    if (!isFiniteNumber(prev) || !isFiniteNumber(current)) {
      return out;
    }
    const change = current - prev;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  const avgGains = wilderSmooth(gains, period);
  const avgLosses = wilderSmooth(losses, period);

  for (let i = 0; i < avgGains.length; i += 1) {
    const avgGain = avgGains[i];
    const avgLoss = avgLosses[i];
    if (avgGain === null || avgLoss === null) {
      continue;
    }
    out[i + 1] = rsiFromAverages(avgGain, avgLoss);
  }

  return out;
}

export function rsiLast(
  closes: readonly number[],
  period: number = RSI_PERIOD,
): number | null {
  const series = rsiSeries(closes, period);
  const last = series[series.length - 1];
  return last === undefined ? null : last;
}

export function rsiFromAverages(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0 && avgGain === 0) {
    return 50;
  }
  if (avgLoss === 0) {
    return 100;
  }
  if (avgGain === 0) {
    return 0;
  }
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
