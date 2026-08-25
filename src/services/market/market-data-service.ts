import type { Candle, CandleResult, MarketDataProvider, Quote, QuoteResult } from "./provider";
import { MemoryCache } from "./cache";
import { displayNameFor, normalizeInternalSymbol, quoteMatchesMapping, toProviderSymbol } from "./symbols";
import { resolveDataStatus } from "./status";
import { sessionKindFor, type QuoteOrigin } from "./sessions";
import {
  DEFAULT_CANDLE_LIMIT,
  MARKET_CACHE_TTL_MS,
  TECHNICAL_CANDLE_LIMIT,
  candleStaleAfterMs,
  candleTtlMs,
} from "./ttl";
import { DataUnavailableError } from "./errors";
import type { Timeframe } from "@/types/enums";
import { buildTechnicalSnapshot } from "@/engine/technical/technical-analysis";
import {
  emptyTechnicalSnapshot,
  type TechnicalSnapshot,
} from "@/engine/technical/technical-snapshot";
import { ENGINE_ERROR_CODES } from "@/engine/utils/validation";

export type MarketPersistence = {
  persistQuote: (symbol: string, quote: Quote) => Promise<void>;
  persistCandles: (
    symbol: string,
    timeframe: Timeframe,
    candles: Candle[],
  ) => Promise<void>;
  loadLatestQuote: (symbol: string) => Promise<Quote | null>;
  loadCandles: (
    symbol: string,
    timeframe: Timeframe,
    limit: number,
  ) => Promise<Candle[] | null>;
};

export type TechnicalSnapshotResult = {
  snapshot: TechnicalSnapshot;
  candles: Candle[];
  source: string | null;
};

export class MarketDataService {
  constructor(
    private readonly provider: MarketDataProvider | null,
    private readonly quotes: MemoryCache<Quote>,
    private readonly candles: MemoryCache<Candle[]>,
    private readonly persistence: MarketPersistence | null = null,
    private readonly now: () => Date = () => new Date(),
    private readonly technicalSnapshots: MemoryCache<TechnicalSnapshot> = new MemoryCache(),
  ) {}

  async getQuote(rawSymbol: string): Promise<QuoteResult> {
    const symbol = normalizeInternalSymbol(rawSymbol);
    const name = displayNameFor(symbol);
    const cacheKey = `quote:${symbol}`;
    const providerSymbol = toProviderSymbol(symbol);
    if (!providerSymbol) {
      return {
        symbol,
        name,
        quote: null,
        status: "UNAVAILABLE",
        source: null,
      };
    }

    const cached = this.quotes.get(cacheKey);
    if (cached) {
      return this.toQuoteResult(symbol, name, cached, "memory");
    }

    if (this.provider) {
      try {
        const quote = await this.provider.getQuote(providerSymbol);
        if (!quoteMatchesMapping(symbol, quote)) {
          return {
            symbol,
            name,
            quote: null,
            status: "UNAVAILABLE",
            source: null,
          };
        }
        const normalized: Quote = {
          ...quote,
          symbol,
          name: quote.name ?? name,
        };
        this.quotes.set(cacheKey, normalized, MARKET_CACHE_TTL_MS.quote);
        void this.persistence?.persistQuote(symbol, normalized);
        return this.toQuoteResult(symbol, name, normalized, "provider");
      } catch (error) {
        if (!(error instanceof DataUnavailableError)) {
          throw error;
        }
      }
    }

    const staleMemory = this.quotes.peek(cacheKey);
    if (staleMemory) {
      return this.toQuoteResult(symbol, name, staleMemory, "memory");
    }

    const stored = (await this.persistence?.loadLatestQuote(symbol)) ?? null;
    if (stored && quoteMatchesMapping(symbol, stored)) {
      return this.toQuoteResult(symbol, name, stored, "store");
    }

    return {
      symbol,
      name,
      quote: null,
      status: "UNAVAILABLE",
      source: null,
    };
  }

  async getCandles(
    rawSymbol: string,
    timeframe: Timeframe,
    limit = DEFAULT_CANDLE_LIMIT,
  ): Promise<CandleResult> {
    const symbol = normalizeInternalSymbol(rawSymbol);
    const cacheKey = `candles:${symbol}:${timeframe}:${limit}`;
    const providerSymbol = toProviderSymbol(symbol);
    if (!providerSymbol) {
      return {
        symbol,
        timeframe,
        candles: [],
        status: "UNAVAILABLE",
        source: null,
      };
    }

    const cached = this.candles.get(cacheKey);
    if (cached) {
      return this.toCandleResult(symbol, timeframe, cached, "memory");
    }

    if (this.provider) {
      try {
        const rows = await this.provider.getCandles(providerSymbol, {
          timeframe,
          outputSize: limit,
        });
        const normalized = rows.map((candle) => ({ ...candle, symbol }));
        this.candles.set(cacheKey, normalized, candleTtlMs(timeframe));
        void this.persistence?.persistCandles(symbol, timeframe, normalized);
        return this.toCandleResult(symbol, timeframe, normalized, "provider");
      } catch (error) {
        if (!(error instanceof DataUnavailableError)) {
          throw error;
        }
      }
    }

    const staleMemory = this.candles.peek(cacheKey);
    if (staleMemory) {
      return this.toCandleResult(symbol, timeframe, staleMemory, "memory");
    }

    const stored =
      (await this.persistence?.loadCandles(symbol, timeframe, limit)) ?? null;
    if (stored) {
      return this.toCandleResult(symbol, timeframe, stored, "store");
    }

    return {
      symbol,
      timeframe,
      candles: [],
      status: "UNAVAILABLE",
      source: null,
    };
  }

  async getOverview(symbols: string[]): Promise<QuoteResult[]> {
    return Promise.all(symbols.map((item) => this.getQuote(item)));
  }

  /**
   * Load candles once, then compute every indicator locally.
   * Snapshot cache is keyed by symbol, timeframe, status, length, and last bar time
   * so MOCK/STALE/CACHED can never be served as LIVE.
   */
  async getTechnicalSnapshot(
    rawSymbol: string,
    timeframe: Timeframe,
  ): Promise<TechnicalSnapshotResult> {
    const symbol = normalizeInternalSymbol(rawSymbol);
    const candleResult = await this.getCandles(
      symbol,
      timeframe,
      TECHNICAL_CANDLE_LIMIT,
    );

    if (candleResult.status === "UNAVAILABLE" || candleResult.candles.length === 0) {
      return {
        snapshot: emptyTechnicalSnapshot(
          symbol,
          timeframe,
          "UNAVAILABLE",
          ENGINE_ERROR_CODES.DATA_UNAVAILABLE,
        ),
        candles: candleResult.candles,
        source: candleResult.source,
      };
    }

    const last = candleResult.candles[candleResult.candles.length - 1];
    const cacheKey = [
      "technical",
      symbol,
      timeframe,
      candleResult.status,
      String(candleResult.candles.length),
      last?.timestamp.toISOString() ?? "none",
    ].join(":");
    const cached = this.technicalSnapshots.get(cacheKey);
    if (cached) {
      return {
        snapshot: cached,
        candles: candleResult.candles,
        source: candleResult.source,
      };
    }

    const snapshot = buildTechnicalSnapshot({
      symbol,
      timeframe,
      candles: candleResult.candles,
      dataStatus: candleResult.status,
    });
    this.technicalSnapshots.set(cacheKey, snapshot, candleTtlMs(timeframe));
    return {
      snapshot,
      candles: candleResult.candles,
      source: candleResult.source,
    };
  }

  private toQuoteResult(
    symbol: string,
    name: string,
    quote: Quote,
    origin: QuoteOrigin,
  ): QuoteResult {
    return {
      symbol,
      name: quote.name ?? name,
      quote,
      status: resolveDataStatus({
        hasData: true,
        isMock: quote.isMock,
        origin,
        dataTimestamp: quote.dataTimestamp,
        now: this.now(),
        isMarketOpen: quote.isMarketOpen,
        sessionKind: sessionKindFor(symbol),
      }),
      source: String(quote.source),
    };
  }

  private toCandleResult(
    symbol: string,
    timeframe: Timeframe,
    candles: Candle[],
    origin: QuoteOrigin,
  ): CandleResult {
    const last = candles[candles.length - 1];
    return {
      symbol,
      timeframe,
      candles,
      status: resolveDataStatus({
        hasData: candles.length > 0,
        isMock: last?.isMock ?? false,
        origin,
        dataTimestamp: last?.timestamp ?? null,
        now: this.now(),
        isMarketOpen: null,
        sessionKind: sessionKindFor(symbol),
        openTtlMs: candleStaleAfterMs(timeframe),
      }),
      source: last ? String(last.source) : null,
    };
  }
}
