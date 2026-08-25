import type { Timeframe } from "@/types/enums";
import type { HistoricalCandle } from "./candles";
import type {
  HistoricalDataProvider,
  HistoricalDataRequest,
  HistoricalDataResult,
} from "./historical-data-provider";

function hashSymbol(symbol: string): number {
  let hash = 2166136261;
  for (const char of symbol.toUpperCase()) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function timeframeStepMs(timeframe: Timeframe): number {
  switch (timeframe) {
    case "1min":
      return 60_000;
    case "5min":
      return 300_000;
    case "15min":
      return 900_000;
    case "30min":
      return 1_800_000;
    case "1h":
      return 3_600_000;
    case "4h":
      return 14_400_000;
    case "1week":
      return 604_800_000;
    default:
      return 86_400_000;
  }
}

/**
 * Deterministic mock historical candles for tests and dev.
 * Does not use Date.now() — anchored to request range.
 */
export function buildMockHistoricalCandles(input: {
  symbol: string;
  timeframe: Timeframe;
  from: Date;
  to: Date;
}): HistoricalCandle[] {
  const stepMs = timeframeStepMs(input.timeframe);
  const base = 50 + (hashSymbol(input.symbol) % 500);
  const candles: HistoricalCandle[] = [];
  let ts = input.from.getTime();
  const end = input.to.getTime();
  let index = 0;

  while (ts <= end) {
    const drift = Math.sin(index / 12) * 4 + (index % 7) * 0.15;
    const close = Number((base + drift + index * 0.05).toFixed(4));
    const open = Number((close - 0.2).toFixed(4));
    const high = Number((Math.max(open, close) + 0.5).toFixed(4));
    const low = Number((Math.min(open, close) - 0.5).toFixed(4));
    candles.push({
      timestamp: new Date(ts),
      open,
      high,
      low,
      close,
      volume: 800_000 + (hashSymbol(`${input.symbol}-${index}`) % 400_000),
    });
    ts += stepMs;
    index += 1;
  }

  return candles;
}

export class MockHistoricalDataProvider implements HistoricalDataProvider {
  async getHistoricalCandles(
    request: HistoricalDataRequest,
  ): Promise<HistoricalDataResult> {
    return {
      candles: buildMockHistoricalCandles(request),
      dataStatus: "MOCK",
      source: "mock",
      isMock: true,
    };
  }
}
