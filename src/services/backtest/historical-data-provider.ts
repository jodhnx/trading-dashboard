import type { DataStatus } from "@/services/market/provider";
import type { Timeframe } from "@/types/enums";
import type { HistoricalCandle } from "./candles";

export type HistoricalDataRequest = {
  symbol: string;
  timeframe: Timeframe;
  from: Date;
  to: Date;
};

export type HistoricalDataResult = {
  candles: HistoricalCandle[];
  dataStatus: DataStatus;
  source: string;
  isMock: boolean;
};

export interface HistoricalDataProvider {
  getHistoricalCandles(
    request: HistoricalDataRequest,
  ): Promise<HistoricalDataResult>;
}

/**
 * Engine rejects MOCK/STALE/UNAVAILABLE snapshots.
 * Backtests run on CACHED/LIVE-equivalent data while preserving provider status on the result.
 */
export function engineDataStatus(providerStatus: DataStatus): DataStatus {
  if (
    providerStatus === "MOCK" ||
    providerStatus === "STALE" ||
    providerStatus === "UNAVAILABLE"
  ) {
    return "CACHED";
  }
  return providerStatus;
}
