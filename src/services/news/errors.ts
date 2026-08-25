export class NewsUnavailableError extends Error {
  readonly code = "NEWS_UNAVAILABLE";

  constructor(
    message: string,
    readonly details?: {
      provider?: string;
      reason?:
        | "api_error"
        | "malformed"
        | "rate_limit"
        | "timeout"
        | "unconfigured"
        | "invalid_item";
    },
  ) {
    super(message);
    this.name = "NewsUnavailableError";
  }
}
