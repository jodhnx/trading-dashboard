import type { Timeframe } from "@/types/enums";

export const DATA_STATUSES = [
  "LIVE",
  "CACHED",
  "MOCK",
  "STALE",
  "UNAVAILABLE",
] as const;
export type DataStatus = (typeof DATA_STATUSES)[number];

export type DataSource = "twelve-data" | "mock" | "supabase" | "memory";

export interface Quote {
  symbol: string;
  name: string | null;
  exchange: string | null;
  currency: string | null;
  price: number;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  volume: number | null;
  timestamp: Date;
  dataTimestamp: Date;
  isMarketOpen: boolean | null;
  source: DataSource | string;
  isMock: boolean;
}

export interface Candle {
  symbol: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  timeframe: Timeframe;
  source: DataSource | string;
  isMock: boolean;
}

export type HistoricalPrice = Candle;

export interface VolumeData {
  symbol: string;
  volume: number | null;
  averageVolume: number | null;
  timestamp: Date;
  source: DataSource | string;
  isMock: boolean;
}

export interface MarketOverviewItem {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  status: DataStatus;
  source: string | null;
  dataTimestamp: Date | null;
}

export interface MarketOverview {
  asOf: Date;
  source: string;
  isMock: boolean;
  items: MarketOverviewItem[];
}

export interface HistoryOptions {
  timeframe?: Timeframe;
  outputSize?: number;
  start?: Date;
  end?: Date;
}

export interface CandleOptions {
  timeframe: Timeframe;
  outputSize?: number;
  start?: Date;
  end?: Date;
}

export interface VolumeOptions {
  timeframe?: Timeframe;
}

export const DEFAULT_OVERVIEW_SYMBOLS = [
  "SPY",
  "QQQ",
  "NVDA",
  "BTC",
  "XAU",
  "USD",
] as const;

export interface MarketDataProvider {
  readonly id: string;
  readonly isMock: boolean;
  getQuote(symbol: string): Promise<Quote>;
  getHistoricalPrices(
    symbol: string,
    options?: HistoryOptions,
  ): Promise<Candle[]>;
  getCandles(symbol: string, options: CandleOptions): Promise<Candle[]>;
  getVolume(symbol: string, options?: VolumeOptions): Promise<VolumeData>;
  getMarketOverview(symbols?: string[]): Promise<MarketOverview>;
}

export type QuoteResult = {
  symbol: string;
  name: string;
  quote: Quote | null;
  status: DataStatus;
  source: string | null;
};

export type CandleResult = {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  status: DataStatus;
  source: string | null;
};
