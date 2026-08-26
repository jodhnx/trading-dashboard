import type { DataFreshness } from "./types";

/**
 * Map provider dataStatus → product freshness.
 * Never treat CACHED/STALE as LIVE.
 * RECENT = CACHED with asOf within 6h (usable recent print, still not LIVE).
 */
export function toDataFreshness(
  dataStatus: string,
  asOfMs?: number | null,
  nowMs: number = Date.now(),
): DataFreshness {
  if (dataStatus === "LIVE") return "LIVE";
  if (dataStatus === "STALE") return "STALE";
  if (dataStatus === "CACHED") {
    if (
      typeof asOfMs === "number" &&
      Number.isFinite(asOfMs) &&
      nowMs - asOfMs >= 0 &&
      nowMs - asOfMs <= 6 * 60 * 60 * 1000
    ) {
      return "RECENT";
    }
    return "CACHED";
  }
  return "UNAVAILABLE";
}

export function freshnessAllowsConfirmed(freshness: DataFreshness): boolean {
  return (
    freshness === "LIVE" || freshness === "RECENT" || freshness === "CACHED"
  );
}

/** Confidence penalty for non-LIVE evidence (ranking may still use cached). */
export function freshnessConfidenceFactor(freshness: DataFreshness): number {
  switch (freshness) {
    case "LIVE":
      return 1;
    case "RECENT":
      return 0.97;
    case "CACHED":
      return 0.9;
    case "STALE":
      return 0.75;
    default:
      return 0;
  }
}
