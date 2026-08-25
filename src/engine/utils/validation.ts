import { isFiniteNumber } from "./math";

export const ENGINE_ERROR_CODES = {
  DATA_UNAVAILABLE: "DATA_UNAVAILABLE",
  INVALID_SYMBOL: "INVALID_SYMBOL",
  INVALID_TIMEFRAME: "INVALID_TIMEFRAME",
} as const;

export type EngineErrorCode =
  (typeof ENGINE_ERROR_CODES)[keyof typeof ENGINE_ERROR_CODES];

export type OhlcvBar = {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

function timestampMs(value: Date | number | string): number | null {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

export function isValidOhlcv(bar: {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}): boolean {
  if (!(bar.timestamp instanceof Date) || Number.isNaN(bar.timestamp.getTime())) {
    return false;
  }
  if (
    !isFiniteNumber(bar.open) ||
    !isFiniteNumber(bar.high) ||
    !isFiniteNumber(bar.low) ||
    !isFiniteNumber(bar.close)
  ) {
    return false;
  }
  if (bar.high < bar.low) {
    return false;
  }
  if (bar.volume !== null && !isFiniteNumber(bar.volume)) {
    return false;
  }
  return true;
}

/**
 * Sort ascending by timestamp, drop invalid bars, keep the last bar on duplicate timestamps.
 * Never fills missing bars.
 */
export function prepareCandles(bars: readonly OhlcvBar[]): OhlcvBar[] {
  const byTimestamp = new Map<number, OhlcvBar>();
  for (const bar of bars) {
    if (!isValidOhlcv(bar)) {
      continue;
    }
    byTimestamp.set(bar.timestamp.getTime(), {
      timestamp: bar.timestamp,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
    });
  }
  return [...byTimestamp.values()].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
}

/**
 * No look-ahead: a snapshot at T may only use candles with timestamp <= T.
 */
export function candlesAtOrBefore(
  bars: readonly OhlcvBar[],
  asOf: Date | number | string,
): OhlcvBar[] {
  const cutoff = timestampMs(asOf);
  if (cutoff === null) {
    return [];
  }
  return prepareCandles(bars).filter((bar) => bar.timestamp.getTime() <= cutoff);
}
