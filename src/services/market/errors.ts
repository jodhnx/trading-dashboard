export class DataUnavailableError extends Error {
  readonly code = "DATA_UNAVAILABLE";

  constructor(
    message: string,
    readonly details?: {
      symbol?: string;
      provider?: string;
      reason?:
        | "missing_price"
        | "missing_timestamp"
        | "missing_symbol"
        | "api_error"
        | "malformed"
        | "rate_limit"
        | "timeout"
        | "unsupported_timeframe"
        | "invalid_symbol"
        | "unmapped_symbol"
        | "wrong_instrument"
        | "range_too_large"
        | "empty_range"
        | "invalid_candles"
        | "provider_unavailable";
    },
  ) {
    super(message);
    this.name = "DataUnavailableError";
  }
}
