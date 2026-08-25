import type { DataStatus } from "@/services/market/provider";
import type { Timeframe } from "@/types/enums";
import { emaLast, EMA_PERIODS } from "../indicators/ema";
import { rsiLast, RSI_PERIOD } from "../indicators/rsi";
import { macdLast } from "../indicators/macd";
import { atrLast, ATR_PERIOD } from "../indicators/atr";
import { analyzeVolume } from "../indicators/volume";
import { supportResistance } from "../indicators/support-resistance";
import {
  candlesAtOrBefore,
  ENGINE_ERROR_CODES,
  prepareCandles,
  type OhlcvBar,
} from "../utils/validation";
import {
  classifyMomentum,
  classifyTechnicalCondition,
  classifyTrend,
  classifyVolatility,
} from "./classify";
import {
  emptyTechnicalSnapshot,
  type TechnicalSnapshot,
} from "./technical-snapshot";

export type BuildTechnicalSnapshotInput = {
  symbol: string;
  timeframe: Timeframe;
  candles: readonly OhlcvBar[];
  dataStatus: DataStatus;
  /** Snapshot time T. Only candles with timestamp <= T are used. Defaults to last candle. */
  asOf?: Date | null;
};

/**
 * Build a TechnicalSnapshot from OHLCV candles already loaded.
 * One candle set → every indicator locally. No API, Supabase, or OpenAI calls.
 */
export function buildTechnicalSnapshot(
  input: BuildTechnicalSnapshotInput,
): TechnicalSnapshot {
  const prepared = input.asOf
    ? candlesAtOrBefore(input.candles, input.asOf)
    : prepareCandles(input.candles);

  if (prepared.length === 0) {
    return emptyTechnicalSnapshot(
      input.symbol,
      input.timeframe,
      "UNAVAILABLE",
      ENGINE_ERROR_CODES.DATA_UNAVAILABLE,
    );
  }

  const last = prepared[prepared.length - 1]!;
  const previous = prepared.length >= 2 ? prepared[prepared.length - 2]! : null;
  const currentPrice = last.close;
  const previousClose = previous ? previous.close : null;
  const change =
    previousClose !== null ? currentPrice - previousClose : null;
  const changePercent =
    change !== null && previousClose !== null && previousClose !== 0
      ? (change / previousClose) * 100
      : null;

  const closes = prepared.map((bar) => bar.close);
  const ema20 = emaLast(closes, EMA_PERIODS.ema20);
  const ema50 = emaLast(closes, EMA_PERIODS.ema50);
  const ema200 = emaLast(closes, EMA_PERIODS.ema200);
  const rsi14 = rsiLast(closes, RSI_PERIOD);
  const macdPoint = macdLast(closes);
  const atr14 = atrLast(prepared, ATR_PERIOD);
  const volumeMetrics = analyzeVolume(prepared.map((bar) => bar.volume));
  const levels = supportResistance(prepared, currentPrice);

  const trend = classifyTrend({
    currentPrice,
    ema20,
    ema50,
    ema200,
  });
  const momentum = classifyMomentum({
    rsi14,
    macdHistogram: macdPoint.histogram,
  });
  const volatility = classifyVolatility({ atr14, currentPrice });
  const technicalCondition = classifyTechnicalCondition({
    trend,
    momentum,
    volatility,
  });

  return {
    symbol: input.symbol,
    timeframe: input.timeframe,
    asOf: last.timestamp,
    currentPrice,
    previousClose,
    change,
    changePercent,
    high: last.high,
    low: last.low,
    volume: last.volume,
    ema20,
    ema50,
    ema200,
    rsi14,
    macd: macdPoint.macd,
    macdSignal: macdPoint.signal,
    macdHistogram: macdPoint.histogram,
    atr14,
    currentVolume: volumeMetrics.currentVolume,
    averageVolume20: volumeMetrics.averageVolume20,
    volumeRatio: volumeMetrics.volumeRatio,
    volumeTrend: volumeMetrics.volumeTrend,
    supportLevels: levels.supportLevels,
    resistanceLevels: levels.resistanceLevels,
    trend,
    momentum,
    volatility,
    technicalCondition,
    dataStatus: input.dataStatus,
    dataError: null,
  };
}
