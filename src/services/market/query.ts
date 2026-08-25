import {
  historyLimitSchema,
  symbolSchema,
  timeframeSchema,
} from "./schemas";
import { DEFAULT_CANDLE_LIMIT } from "./ttl";
import type { Timeframe } from "@/types/enums";
import { ENGINE_ERROR_CODES } from "@/engine/utils/validation";

export function parseQuoteSymbol(raw: string | null): 
  | { ok: true; symbol: string }
  | { ok: false; error: string } {
  const parsed = symbolSchema.safeParse(raw ?? "");
  if (!parsed.success) {
    return { ok: false, error: "Invalid symbol" };
  }
  return { ok: true, symbol: parsed.data };
}

export function parseHistoryQuery(input: {
  symbol: string | null;
  timeframe: string | null;
  limit: string | null;
}):
  | { ok: true; symbol: string; timeframe: (typeof timeframeSchema)["_output"]; limit: number }
  | { ok: false; error: string } {
  const symbol = parseQuoteSymbol(input.symbol);
  if (!symbol.ok) {
    return symbol;
  }

  const timeframe = timeframeSchema.safeParse(input.timeframe ?? "1day");
  if (!timeframe.success) {
    return { ok: false, error: "Invalid timeframe" };
  }

  const limit = historyLimitSchema.safeParse(
    input.limit && input.limit.length > 0 ? input.limit : DEFAULT_CANDLE_LIMIT,
  );
  if (!limit.success) {
    return { ok: false, error: limit.error.issues[0]?.message ?? "Invalid limit" };
  }

  return {
    ok: true,
    symbol: symbol.symbol,
    timeframe: timeframe.data,
    limit: limit.data,
  };
}

export function parseTechnicalQuery(input: {
  symbol: string | null;
  timeframe: string | null;
}):
  | { ok: true; symbol: string; timeframe: Timeframe }
  | {
      ok: false;
      error: string;
      code:
        | typeof ENGINE_ERROR_CODES.INVALID_SYMBOL
        | typeof ENGINE_ERROR_CODES.INVALID_TIMEFRAME;
    } {
  const symbol = symbolSchema.safeParse(input.symbol ?? "");
  if (!symbol.success) {
    return {
      ok: false,
      error: "Invalid symbol",
      code: ENGINE_ERROR_CODES.INVALID_SYMBOL,
    };
  }

  const timeframe = timeframeSchema.safeParse(input.timeframe);
  if (!timeframe.success) {
    return {
      ok: false,
      error: "Invalid timeframe",
      code: ENGINE_ERROR_CODES.INVALID_TIMEFRAME,
    };
  }

  return {
    ok: true,
    symbol: symbol.data,
    timeframe: timeframe.data,
  };
}
