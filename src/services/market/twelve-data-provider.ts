import { EnvValidationError } from "@/lib/env/errors";
import type { Timeframe } from "@/types/enums";
import { TIMEFRAMES } from "@/types/enums";
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
import { PROVIDER_TIMEOUT_MS } from "./ttl";
import { parseQuoteClock, parseTimestamp } from "./timestamps";
import { toProviderSymbol } from "./symbols";

const SOURCE = "twelve-data";
const BASE_URL = "https://api.twelvedata.com";

const INTERVAL: Record<Timeframe, string> = {
  "1min": "1min",
  "5min": "5min",
  "15min": "15min",
  "30min": "30min",
  "1h": "1h",
  "4h": "4h",
  "1day": "1day",
  "1week": "1week",
};

type TwelveErrorBody = {
  status?: string;
  code?: number | string;
  message?: string;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isSupportedTimeframe(value: string): value is Timeframe {
  return (TIMEFRAMES as readonly string[]).includes(value);
}

export class TwelveDataProvider implements MarketDataProvider {
  readonly id = "twelve-data";
  readonly isMock = false;

  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    if (!apiKey.trim()) {
      throw new EnvValidationError("TWELVE_DATA_API_KEY is empty.");
    }
  }

  async getQuote(symbol: string): Promise<Quote> {
    const mapped = toProviderSymbol(symbol);
    if (!mapped) {
      throw new DataUnavailableError("DATA UNAVAILABLE", {
        symbol,
        provider: this.id,
        reason: "unmapped_symbol",
      });
    }

    const payload = await this.request("quote", { symbol: mapped });
    const resolvedSymbol =
      typeof payload.symbol === "string" && payload.symbol.trim()
        ? payload.symbol.trim().toUpperCase()
        : null;

    if (!resolvedSymbol) {
      throw new DataUnavailableError("DATA UNAVAILABLE", {
        symbol,
        provider: this.id,
        reason: "missing_symbol",
      });
    }

    const price = toNumber(payload.close ?? payload.price);
    if (price === null) {
      throw new DataUnavailableError("NO CURRENT MARKET DATA", {
        symbol,
        provider: this.id,
        reason: "missing_price",
      });
    }

    const previousClose = toNumber(payload.previous_close);
    const changeFromApi = toNumber(payload.change);
    const change =
      changeFromApi ??
      (previousClose !== null ? Number((price - previousClose).toFixed(6)) : null);
    const changePercent =
      previousClose && previousClose !== 0
        ? Number((((price - previousClose) / previousClose) * 100).toFixed(4))
        : toNumber(payload.percent_change);

    const timestamp = parseQuoteClock(payload);

    return quoteSchema.parse({
      symbol: resolvedSymbol,
      name: typeof payload.name === "string" ? payload.name : null,
      exchange: typeof payload.exchange === "string" ? payload.exchange : null,
      currency: typeof payload.currency === "string" ? payload.currency : null,
      price,
      change,
      changePercent,
      open: toNumber(payload.open),
      high: toNumber(payload.high),
      low: toNumber(payload.low),
      previousClose,
      volume: toNumber(payload.volume),
      timestamp,
      dataTimestamp: timestamp,
      isMarketOpen:
        typeof payload.is_market_open === "boolean" ? payload.is_market_open : null,
      source: SOURCE,
      isMock: false,
    });
  }

  async getHistoricalPrices(
    symbol: string,
    options?: HistoryOptions,
  ): Promise<Candle[]> {
    return this.getCandles(symbol, {
      timeframe: options?.timeframe ?? "1day",
      outputSize: options?.outputSize,
      start: options?.start,
      end: options?.end,
    });
  }

  async getCandles(symbol: string, options: CandleOptions): Promise<Candle[]> {
    if (!isSupportedTimeframe(options.timeframe)) {
      throw new DataUnavailableError("DATA UNAVAILABLE", {
        symbol,
        provider: this.id,
        reason: "unsupported_timeframe",
      });
    }

    const mapped = toProviderSymbol(symbol);
    if (!mapped) {
      throw new DataUnavailableError("DATA UNAVAILABLE", {
        symbol,
        provider: this.id,
        reason: "unmapped_symbol",
      });
    }

    const params: Record<string, string> = {
      symbol: mapped,
      interval: INTERVAL[options.timeframe],
      outputsize: String(options.outputSize ?? 30),
      order: "ASC",
    };
    if (options.start) {
      params.start_date = formatTwelveDate(options.start);
    }
    if (options.end) {
      params.end_date = formatTwelveDate(options.end);
    }

    const payload = await this.request("time_series", params);
    const values = Array.isArray(payload.values) ? payload.values : [];
    if (values.length === 0) {
      throw new DataUnavailableError("NO CURRENT MARKET DATA", {
        symbol,
        provider: this.id,
        reason: "malformed",
      });
    }

    return values.map((row) => {
      const record = asRecord(row);
      const open = toNumber(record.open);
      const high = toNumber(record.high);
      const low = toNumber(record.low);
      const close = toNumber(record.close);

      if (open === null || high === null || low === null || close === null) {
        throw new DataUnavailableError("NO CURRENT MARKET DATA", {
          symbol,
          provider: this.id,
          reason: "malformed",
        });
      }

      return candleSchema.parse({
        symbol: symbol.toUpperCase(),
        timestamp: parseTimestamp(record.datetime),
        open,
        high,
        low,
        close,
        volume: toNumber(record.volume),
        timeframe: options.timeframe,
        source: SOURCE,
        isMock: false,
      });
    });
  }

  async getVolume(symbol: string, options?: VolumeOptions): Promise<VolumeData> {
    const quote = await this.getQuote(symbol);
    let averageVolume: number | null = null;

    try {
      const candles = await this.getCandles(symbol, {
        timeframe: options?.timeframe ?? "1day",
        outputSize: 20,
      });
      const volumes = candles
        .map((candle) => candle.volume)
        .filter((volume): volume is number => volume !== null);
      if (volumes.length > 0) {
        averageVolume = volumes.reduce((sum, value) => sum + value, 0) / volumes.length;
      }
    } catch (error) {
      if (!(error instanceof DataUnavailableError)) {
        throw error;
      }
    }

    return volumeSchema.parse({
      symbol: quote.symbol,
      volume: quote.volume,
      averageVolume,
      timestamp: quote.timestamp,
      source: SOURCE,
      isMock: false,
    });
  }

  async getMarketOverview(symbols?: string[]): Promise<MarketOverview> {
    const list = symbols?.length ? symbols : [...DEFAULT_OVERVIEW_SYMBOLS];
    const settled = await Promise.allSettled(
      list.map(async (symbol) => this.getQuote(symbol)),
    );

    const items = settled.map((result, index) => {
      if (result.status === "fulfilled") {
        return {
          symbol: result.value.symbol,
          name: result.value.name ?? result.value.symbol,
          price: result.value.price,
          change: result.value.change,
          changePercent: result.value.changePercent,
          status: "LIVE" as const,
          source: SOURCE,
          dataTimestamp: result.value.dataTimestamp,
        };
      }

      return {
        symbol: list[index]!.toUpperCase(),
        name: list[index]!.toUpperCase(),
        price: null,
        change: null,
        changePercent: null,
        status: "UNAVAILABLE" as const,
        source: null,
        dataTimestamp: null,
      };
    });

    return {
      asOf: new Date(),
      source: SOURCE,
      isMock: false,
      items,
    };
  }

  private async request(
    path: string,
    params: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const url = new URL(`${BASE_URL}/${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("apikey", this.apiKey);

    let response: Response;
    try {
      response = await this.fetchFn(url.toString(), {
        cache: "no-store",
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.name === "TimeoutError"
          ? "timeout"
          : "api_error";
      throw new DataUnavailableError("DATA UNAVAILABLE", {
        provider: this.id,
        symbol: params.symbol,
        reason,
      });
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new DataUnavailableError("DATA UNAVAILABLE", {
        provider: this.id,
        symbol: params.symbol,
        reason: "malformed",
      });
    }

    const record = asRecord(payload);
    if (Object.keys(record).length === 0 && payload !== null) {
      throw new DataUnavailableError("DATA UNAVAILABLE", {
        provider: this.id,
        symbol: params.symbol,
        reason: "malformed",
      });
    }

    const errorBody = record as TwelveErrorBody;
    const code = Number(errorBody.code);
    if (response.status === 429 || code === 429) {
      throw new DataUnavailableError("DATA UNAVAILABLE", {
        provider: this.id,
        symbol: params.symbol,
        reason: "rate_limit",
      });
    }

    if (!response.ok || errorBody.status === "error") {
      const reason =
        /invalid symbol/i.test(String(errorBody.message ?? ""))
          ? "invalid_symbol"
          : "api_error";
      throw new DataUnavailableError("DATA UNAVAILABLE", {
        provider: this.id,
        symbol: params.symbol,
        reason,
      });
    }

    return record;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function formatTwelveDate(value: Date): string {
  return value.toISOString().slice(0, 19).replace("T", " ");
}
