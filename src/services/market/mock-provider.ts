import { DataUnavailableError } from "./errors";
import type {
  Candle,
  CandleOptions,
  HistoryOptions,
  MarketDataProvider,
  MarketOverview,
  Quote,
  VolumeData,
  VolumeOptions,
} from "./provider";
import { DEFAULT_OVERVIEW_SYMBOLS } from "./provider";
import { candleSchema, quoteSchema, volumeSchema } from "./schemas";
import type { Timeframe } from "@/types/enums";

const SOURCE = "mock";

function hashSymbol(symbol: string): number {
  let hash = 2166136261;
  for (const char of symbol.toUpperCase()) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mockPrice(symbol: string): number {
  const hash = hashSymbol(symbol);
  return Number((25 + (hash % 500000) / 100).toFixed(2));
}

function buildQuote(symbol: string, now: Date): Quote {
  const price = mockPrice(symbol);
  const open = Number((price * 0.992).toFixed(2));
  const high = Number((price * 1.012).toFixed(2));
  const low = Number((price * 0.981).toFixed(2));
  const previousClose = Number((price * 0.997).toFixed(2));
  const change = Number((price - previousClose).toFixed(2));
  const changePercent = Number(
    (((price - previousClose) / previousClose) * 100).toFixed(2),
  );
  const timestamp = now;

  return quoteSchema.parse({
    symbol: symbol.toUpperCase(),
    name: `${symbol.toUpperCase()} MOCK`,
    exchange: "MOCK",
    currency: "USD",
    price,
    change,
    changePercent,
    open,
    high,
    low,
    previousClose,
    volume: 1_000_000 + (hashSymbol(symbol) % 5_000_000),
    timestamp,
    dataTimestamp: timestamp,
    isMarketOpen: true,
    source: SOURCE,
    isMock: true,
  });
}

function buildCandles(
  symbol: string,
  timeframe: Timeframe,
  outputSize: number,
  now: Date,
): Candle[] {
  const stepMs =
    timeframe === "1min"
      ? 60_000
      : timeframe === "5min"
        ? 300_000
        : timeframe === "15min"
          ? 900_000
          : timeframe === "30min"
            ? 1_800_000
            : timeframe === "1h"
            ? 3_600_000
            : timeframe === "4h"
              ? 14_400_000
              : timeframe === "1week"
                ? 604_800_000
                : 86_400_000;

  const base = mockPrice(symbol);
  const candles: Candle[] = [];

  for (let i = outputSize - 1; i >= 0; i -= 1) {
    const drift = ((hashSymbol(`${symbol}-${i}`) % 200) - 100) / 100;
    const close = Number((base + drift).toFixed(2));
    const open = Number((close - drift / 2).toFixed(2));
    const high = Number((Math.max(open, close) + 0.4).toFixed(2));
    const low = Number((Math.min(open, close) - 0.4).toFixed(2));

    candles.push(
      candleSchema.parse({
        symbol: symbol.toUpperCase(),
        timestamp: new Date(now.getTime() - i * stepMs),
        open,
        high,
        low,
        close,
        volume: 800_000 + (hashSymbol(`${symbol}-${i}`) % 400_000),
        timeframe,
        source: SOURCE,
        isMock: true,
      }),
    );
  }

  return candles;
}

export class MockMarketDataProvider implements MarketDataProvider {
  readonly id = "mock";
  readonly isMock = true;

  constructor(private readonly now: Date = new Date("2026-08-24T12:00:00.000Z")) {}

  async getQuote(symbol: string): Promise<Quote> {
    return buildQuote(symbol, this.now);
  }

  async getHistoricalPrices(
    symbol: string,
    options?: HistoryOptions,
  ): Promise<Candle[]> {
    return this.getCandles(symbol, {
      timeframe: options?.timeframe ?? "1day",
      outputSize: options?.outputSize,
    });
  }

  async getCandles(symbol: string, options: CandleOptions): Promise<Candle[]> {
    return buildCandles(
      symbol,
      options.timeframe,
      options.outputSize ?? 30,
      this.now,
    );
  }

  async getVolume(symbol: string, options?: VolumeOptions): Promise<VolumeData> {
    void options;
    const quote = await this.getQuote(symbol);
    return volumeSchema.parse({
      symbol: quote.symbol,
      volume: quote.volume,
      averageVolume: quote.volume ? Math.round(quote.volume * 0.92) : null,
      timestamp: quote.timestamp,
      source: SOURCE,
      isMock: true,
    });
  }

  async getMarketOverview(symbols?: string[]): Promise<MarketOverview> {
    const list = symbols?.length ? symbols : [...DEFAULT_OVERVIEW_SYMBOLS];
    const items = await Promise.all(
      list.map(async (symbol) => {
        const quote = await this.getQuote(symbol);
        return {
          symbol: quote.symbol,
          name: quote.name ?? quote.symbol,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          status: "MOCK" as const,
          source: SOURCE,
          dataTimestamp: quote.dataTimestamp,
        };
      }),
    );

    return {
      asOf: this.now,
      source: SOURCE,
      isMock: true,
      items,
    };
  }

  async missingOnPurpose(symbol: string): Promise<never> {
    throw new DataUnavailableError("DATA UNAVAILABLE", {
      symbol,
      provider: this.id,
    });
  }
}
