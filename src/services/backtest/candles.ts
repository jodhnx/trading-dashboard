import type { OhlcvBar } from "@/engine/utils/validation";
import { prepareCandles } from "@/engine/utils/validation";
import { isFiniteNumber } from "@/engine/utils/math";

export type HistoricalCandle = OhlcvBar;

export type CandleValidationResult =
  | { ok: true; candles: HistoricalCandle[] }
  | { ok: false; error: string };

/**
 * Validate OHLCV bars for backtesting.
 * - finite numbers
 * - high >= max(open, close), low <= min(open, close), high >= low
 * - chronological ordering via prepareCandles
 * - duplicate timestamps: last input bar wins (prepareCandles)
 */
export function validateHistoricalCandles(
  bars: readonly HistoricalCandle[],
): CandleValidationResult {
  if (bars.length === 0) {
    return { ok: false, error: "No candles provided." };
  }

  for (const bar of bars) {
    if (!(bar.timestamp instanceof Date) || Number.isNaN(bar.timestamp.getTime())) {
      return { ok: false, error: "Invalid candle timestamp." };
    }
    if (
      !isFiniteNumber(bar.open) ||
      !isFiniteNumber(bar.high) ||
      !isFiniteNumber(bar.low) ||
      !isFiniteNumber(bar.close)
    ) {
      return { ok: false, error: "Candle prices must be finite numbers." };
    }
    if (bar.high < bar.low) {
      return { ok: false, error: "Candle high must be >= low." };
    }
    const bodyHigh = Math.max(bar.open, bar.close);
    const bodyLow = Math.min(bar.open, bar.close);
    if (bar.high < bodyHigh || bar.low > bodyLow) {
      return { ok: false, error: "Candle OHLC relationship is invalid." };
    }
    if (bar.volume !== null && !isFiniteNumber(bar.volume)) {
      return { ok: false, error: "Candle volume must be finite when present." };
    }
  }

  const prepared = prepareCandles(bars);
  if (prepared.length === 0) {
    return { ok: false, error: "No valid candles after preparation." };
  }

  for (let i = 1; i < prepared.length; i += 1) {
    const prev = prepared[i - 1]!;
    const current = prepared[i]!;
    if (current.timestamp.getTime() <= prev.timestamp.getTime()) {
      return { ok: false, error: "Candles must be strictly chronological." };
    }
  }

  return { ok: true, candles: prepared };
}

export function filterCandlesInRange(
  candles: readonly HistoricalCandle[],
  from: Date,
  to: Date,
): HistoricalCandle[] {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  return candles.filter((bar) => {
    const ms = bar.timestamp.getTime();
    return ms >= fromMs && ms <= toMs;
  });
}
