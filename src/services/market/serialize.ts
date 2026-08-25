import type { Candle, CandleResult, Quote, QuoteResult } from "./provider";
import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import type { PriceLevel } from "@/engine/indicators/support-resistance";
import type { TradingSetup } from "@/engine/trading/types";

export type SerializedQuote = Omit<Quote, "timestamp" | "dataTimestamp"> & {
  timestamp: string;
  dataTimestamp: string;
};

export type SerializedCandle = Omit<Candle, "timestamp"> & {
  timestamp: string;
};

export function serializeQuote(quote: Quote): SerializedQuote {
  return {
    ...quote,
    timestamp: quote.timestamp.toISOString(),
    dataTimestamp: quote.dataTimestamp.toISOString(),
  };
}

export function serializeQuoteResult(result: QuoteResult) {
  return {
    symbol: result.symbol,
    name: result.name,
    status: result.status,
    source: result.source,
    quote: result.quote ? serializeQuote(result.quote) : null,
  };
}

export function serializeCandleResult(result: CandleResult) {
  return {
    symbol: result.symbol,
    timeframe: result.timeframe,
    status: result.status,
    source: result.source,
    candles: result.candles.map(
      (candle): SerializedCandle => ({
        ...candle,
        timestamp: candle.timestamp.toISOString(),
      }),
    ),
  };
}

export type SerializedPriceLevel = PriceLevel;

export type SerializedTechnicalSnapshot = Omit<TechnicalSnapshot, "asOf"> & {
  asOf: string | null;
};

export function serializeTechnicalSnapshot(
  snapshot: TechnicalSnapshot,
): SerializedTechnicalSnapshot {
  return {
    ...snapshot,
    asOf: snapshot.asOf ? snapshot.asOf.toISOString() : null,
  };
}

export type SerializedTradingSetup = Omit<TradingSetup, "createdAt"> & {
  createdAt: string;
};

export function serializeTradingSetup(setup: TradingSetup): SerializedTradingSetup {
  return {
    ...setup,
    createdAt: setup.createdAt.toISOString(),
  };
}
