import type { DataStatus } from "./provider";
import {
  resolveMarketOpen,
  type QuoteOrigin,
  type SessionKind,
} from "./sessions";
import { MARKET_STALE_AFTER_MS } from "./ttl";

export function resolveDataStatus(input: {
  hasData: boolean;
  isMock: boolean;
  origin: QuoteOrigin;
  dataTimestamp: Date | null;
  now: Date;
  isMarketOpen?: boolean | null;
  sessionKind: SessionKind;
  openTtlMs?: number;
}): DataStatus {
  if (!input.hasData) {
    return "UNAVAILABLE";
  }
  if (input.isMock) {
    return "MOCK";
  }

  const marketOpen = resolveMarketOpen(
    input.isMarketOpen,
    input.sessionKind,
    input.now,
  );
  const ageMs = input.dataTimestamp
    ? input.now.getTime() - input.dataTimestamp.getTime()
    : Number.POSITIVE_INFINITY;

  if (marketOpen) {
    const openTtl =
      input.openTtlMs ??
      (input.sessionKind === "crypto"
        ? MARKET_STALE_AFTER_MS.crypto
        : MARKET_STALE_AFTER_MS.quoteOpen);
    if (ageMs > openTtl) {
      return "STALE";
    }
    return input.origin === "provider" ? "LIVE" : "CACHED";
  }

  const closedMax = MARKET_STALE_AFTER_MS.closedSession[input.sessionKind];
  if (ageMs > closedMax) {
    return "STALE";
  }

  return "CACHED";
}
