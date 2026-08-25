import "server-only";

import { tryCreateMarketDataProvider } from "@/services/market/factory";
import { DataUnavailableError } from "@/services/market/errors";
import { toProviderSymbol } from "@/services/market/symbols";
import type { OhlcvBar } from "@/engine/utils/validation";
import { BACKTEST_MAX_CANDLES } from "./constants";
import {
  filterCandlesInRange,
  validateHistoricalCandles,
} from "./candles";
import type {
  HistoricalDataProvider,
  HistoricalDataRequest,
  HistoricalDataResult,
} from "./historical-data-provider";

export class TwelveDataHistoricalProvider implements HistoricalDataProvider {
  async getHistoricalCandles(
    request: HistoricalDataRequest,
  ): Promise<HistoricalDataResult> {
    const provider = tryCreateMarketDataProvider();
    if (!provider) {
      throw new DataUnavailableError("DATA UNAVAILABLE", {
        symbol: request.symbol,
        reason: "provider_unavailable",
      });
    }

    if (provider.isMock) {
      const { MockHistoricalDataProvider } = await import(
        "./mock-historical-provider"
      );
      return new MockHistoricalDataProvider().getHistoricalCandles(request);
    }

    const mapped = toProviderSymbol(request.symbol);
    if (!mapped) {
      throw new DataUnavailableError("DATA UNAVAILABLE", {
        symbol: request.symbol,
        reason: "unmapped_symbol",
      });
    }

    const raw = await provider.getCandles(request.symbol, {
      timeframe: request.timeframe,
      start: request.from,
      end: request.to,
      outputSize: BACKTEST_MAX_CANDLES,
    });

    const bars: OhlcvBar[] = raw.map((candle) => ({
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));

    const validated = validateHistoricalCandles(bars);
    if (!validated.ok) {
      throw new DataUnavailableError("DATA UNAVAILABLE", {
        symbol: request.symbol,
        reason: "invalid_candles",
      });
    }

    const inRange = filterCandlesInRange(
      validated.candles,
      request.from,
      request.to,
    );
    if (inRange.length === 0) {
      throw new DataUnavailableError("NO CURRENT MARKET DATA", {
        symbol: request.symbol,
        reason: "empty_range",
      });
    }

    if (inRange.length > BACKTEST_MAX_CANDLES) {
      throw new DataUnavailableError("DATA UNAVAILABLE", {
        symbol: request.symbol,
        reason: "range_too_large",
      });
    }

    return {
      candles: inRange,
      dataStatus: "LIVE",
      source: provider.id,
      isMock: false,
    };
  }
}

export function createHistoricalDataProvider(): HistoricalDataProvider {
  return new TwelveDataHistoricalProvider();
}
