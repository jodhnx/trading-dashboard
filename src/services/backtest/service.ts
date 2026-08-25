import "server-only";

import { toTradingRiskSettings } from "@/lib/settings/schema";
import { getOrCreateAccountSettings } from "@/lib/settings/service";
import { DataUnavailableError } from "@/services/market/errors";
import {
  displayNameFor,
  getWatchAsset,
  normalizeInternalSymbol,
  toProviderSymbol,
} from "@/services/market/symbols";
import { BACKTEST_MAX_CANDLES, BACKTEST_WARMUP_BARS } from "./constants";
import { validateHistoricalCandles } from "./candles";
import { buildBacktestResult } from "./metrics";
import { createHistoricalDataProvider } from "./twelve-data-historical-provider";
import { runBacktestSimulation } from "./simulation";
import type {
  BacktestErrorCode,
  BacktestResult,
  BacktestWorkspaceSnapshot,
} from "./types";
import {
  backtestConfigFromRequest,
  backtestRequestSchema,
} from "./validation";

export type BacktestServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: BacktestErrorCode; error: string };

export async function getBacktestWorkspace(input: {
  userId: string;
  email: string | null;
}): Promise<BacktestServiceResult<BacktestWorkspaceSnapshot>> {
  try {
    const settings = await getOrCreateAccountSettings(input.userId, input.email);
    return {
      ok: true,
      data: {
        riskSettings: {
          riskPerTradePercent: settings.riskPerTradePercent,
          maxPositionPercent: settings.maxPositionPercent,
          minimumRiskReward: settings.minimumRiskReward,
        },
      },
    };
  } catch {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Settings unavailable.",
    };
  }
}

export async function runBacktest(input: {
  userId: string;
  email: string | null;
  body: unknown;
}): Promise<BacktestServiceResult<BacktestResult>> {
  const parsed = backtestRequestSchema.safeParse(input.body);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      error: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  const symbol = normalizeInternalSymbol(parsed.data.symbol);
  const watched = getWatchAsset(symbol);
  if (!watched) {
    return {
      ok: false,
      code: "ASSET_NOT_FOUND",
      error: "Unknown asset symbol.",
    };
  }
  if (!toProviderSymbol(symbol)) {
    return {
      ok: false,
      code: "ASSET_NOT_FOUND",
      error: `${displayNameFor(symbol)} is not available for historical data.`,
    };
  }

  let settings;
  try {
    settings = await getOrCreateAccountSettings(input.userId, input.email);
  } catch {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Settings unavailable.",
    };
  }

  const config = backtestConfigFromRequest(parsed.data);
  const provider = createHistoricalDataProvider();

  let historical;
  try {
    historical = await provider.getHistoricalCandles({
      symbol,
      timeframe: config.timeframe,
      from: config.from,
      to: config.to,
    });
  } catch (error) {
    if (error instanceof DataUnavailableError) {
      const reason = String(error.details?.reason ?? "");
      if (reason === "range_too_large") {
        return {
          ok: false,
          code: "RANGE_TOO_LARGE",
          error: `Historical range exceeds ${BACKTEST_MAX_CANDLES} candles.`,
        };
      }
      if (reason === "empty_range" || reason === "invalid_candles") {
        return {
          ok: false,
          code: "INVALID_DATA",
          error: "Historical candle data is invalid or empty for this range.",
        };
      }
      return {
        ok: false,
        code: "DATA_UNAVAILABLE",
        error: "Historical market data is unavailable.",
      };
    }
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Historical market data is unavailable.",
    };
  }

  if (historical.dataStatus === "UNAVAILABLE") {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Historical market data is unavailable.",
    };
  }

  const validated = validateHistoricalCandles(historical.candles);
  if (!validated.ok) {
    return {
      ok: false,
      code: "INVALID_DATA",
      error: validated.error,
    };
  }

  if (validated.candles.length > BACKTEST_MAX_CANDLES) {
    return {
      ok: false,
      code: "RANGE_TOO_LARGE",
      error: `Historical range exceeds ${BACKTEST_MAX_CANDLES} candles.`,
    };
  }

  if (validated.candles.length <= BACKTEST_WARMUP_BARS + 1) {
    return {
      ok: false,
      code: "INSUFFICIENT_DATA",
      error: `At least ${BACKTEST_WARMUP_BARS + 2} candles are required for backtesting.`,
    };
  }

  const riskSettings = toTradingRiskSettings({
    capital: config.startingCapital,
    riskPerTradePercent: settings.riskPerTradePercent,
    maxPositionPercent: settings.maxPositionPercent,
    minimumRiskReward: settings.minimumRiskReward,
  });

  const simulation = runBacktestSimulation({
    config: { ...config, symbol },
    candles: validated.candles,
    providerDataStatus: historical.dataStatus,
    baseRiskSettings: {
      maxRiskPercent: riskSettings.maxRiskPercent,
      maxPositionPercent: riskSettings.maxPositionPercent,
      minimumRiskReward: riskSettings.minimumRiskReward,
    },
  });

  const result = buildBacktestResult({
    symbol,
    timeframe: config.timeframe,
    from: parsed.data.from,
    to: parsed.data.to,
    startingCapital: config.startingCapital,
    endingCapital: simulation.endingCapital,
    dataStatus: historical.dataStatus,
    trades: simulation.trades,
    equityCurve: simulation.equityCurve,
  });

  return { ok: true, data: result };
}

export function httpStatusForBacktestError(code: BacktestErrorCode): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "INVALID_INPUT":
    case "INSUFFICIENT_DATA":
      return 400;
    case "ASSET_NOT_FOUND":
      return 404;
    case "RANGE_TOO_LARGE":
    case "INVALID_DATA":
      return 422;
    default:
      return 503;
  }
}
