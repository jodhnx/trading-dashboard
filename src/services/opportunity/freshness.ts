import type { DataFreshness, RankedOpportunity } from "./types";

export type CandidateFreshnessTimestamps = {
  marketUpdatedAt: string | null;
  technicalCalculatedAt: string | null;
  newsUpdatedAt: string | null;
  aiAnalyzedAt: string | null;
};

export function buildCandidateTimestamps(input: {
  snapshotAsOf: string | Date | null | undefined;
  scannedAt: string;
  latestNewsAt: string | null | undefined;
  aiAnalyzedAt?: string | null;
}): CandidateFreshnessTimestamps {
  const asOf =
    input.snapshotAsOf instanceof Date
      ? input.snapshotAsOf.toISOString()
      : input.snapshotAsOf ?? null;
  const marketUpdatedAt = asOf;
  return {
    marketUpdatedAt,
    technicalCalculatedAt: marketUpdatedAt ?? input.scannedAt,
    newsUpdatedAt: input.latestNewsAt ?? null,
    aiAnalyzedAt: input.aiAnalyzedAt ?? null,
  };
}

export function freshnessLabel(freshness: DataFreshness): string {
  switch (freshness) {
    case "LIVE":
      return "Live provider print";
    case "RECENT":
      return "Recent cached print (within 6h)";
    case "CACHED":
      return "Cached provider data";
    case "STALE":
      return "Stale provider data";
    default:
      return "Unavailable";
  }
}

export function isLiveFreshness(freshness: DataFreshness): boolean {
  return freshness === "LIVE";
}

export function attachFreshnessTimestamps(
  candidate: RankedOpportunity,
  timestamps: CandidateFreshnessTimestamps,
): RankedOpportunity {
  return { ...candidate, ...timestamps };
}
