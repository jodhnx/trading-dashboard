import type { OpportunityCandidateDiagnostic } from "./types";

export function buildFreshnessCountsFixture(nowMs: number): {
  liveCount: number;
  recentCount: number;
  cachedCount: number;
  staleCount: number;
  unavailableCount: number;
  dataSkippedCount: number;
  skipReasons: Record<string, number>;
} {
  const diagnostics: OpportunityCandidateDiagnostic[] = [
    {
      symbol: "AAPL",
      assetType: "STOCK",
      quoteStatus: "LIVE",
      technicalStatus: "LIVE",
      engineStatus: "VALID",
      engineDirection: "LONG",
      engineScore: 80,
      technicalScore: 80,
      momentumScore: 70,
      volumeScore: 60,
      newsScore: 50,
      catalystScore: 50,
      sentimentScore: 50,
      regimeScore: 50,
      riskRewardScore: 70,
      multiTimeFrameScore: 50,
      multiTimeframeScore: 50,
      finalOpportunityScore: 75,
      tier: "OPPORTUNITY",
      quality: "CONFIRMED",
      rejectionReason: null,
      dataFreshness: "LIVE",
    },
    {
      symbol: "MSFT",
      assetType: "STOCK",
      quoteStatus: "CACHED",
      technicalStatus: "CACHED",
      engineStatus: "VALID",
      engineDirection: "LONG",
      engineScore: 70,
      technicalScore: 70,
      momentumScore: 60,
      volumeScore: 55,
      newsScore: 45,
      catalystScore: 40,
      sentimentScore: 50,
      regimeScore: 50,
      riskRewardScore: 60,
      multiTimeFrameScore: 50,
      multiTimeframeScore: 50,
      finalOpportunityScore: 65,
      tier: "WATCH",
      quality: "WATCH",
      rejectionReason: null,
      dataFreshness: "RECENT",
    },
    {
      symbol: "TSLA",
      assetType: "STOCK",
      quoteStatus: "CACHED",
      technicalStatus: "CACHED",
      engineStatus: "INVALID",
      engineDirection: "NO_TRADE",
      engineScore: null,
      technicalScore: 40,
      momentumScore: 40,
      volumeScore: 40,
      newsScore: 40,
      catalystScore: 40,
      sentimentScore: 50,
      regimeScore: 50,
      riskRewardScore: 40,
      multiTimeFrameScore: 50,
      multiTimeframeScore: 50,
      finalOpportunityScore: 40,
      tier: "NO_TRADE",
      quality: "NO_TRADE",
      rejectionReason: null,
      dataFreshness: "CACHED",
    },
    {
      symbol: "XYZ",
      assetType: "STOCK",
      quoteStatus: "UNAVAILABLE",
      technicalStatus: "UNAVAILABLE",
      engineStatus: "SKIPPED",
      engineDirection: "NO_TRADE",
      engineScore: null,
      technicalScore: 0,
      momentumScore: 0,
      volumeScore: 0,
      newsScore: 0,
      catalystScore: 0,
      sentimentScore: 0,
      regimeScore: 0,
      riskRewardScore: 0,
      multiTimeFrameScore: 0,
      multiTimeframeScore: 0,
      finalOpportunityScore: 0,
      tier: "DATA_SKIP",
      quality: "DATA_SKIP",
      rejectionReason: "provider_rate_limit",
    },
  ];

  void nowMs;

  let liveCount = 0;
  let recentCount = 0;
  let cachedCount = 0;
  let staleCount = 0;
  let unavailableCount = 0;
  let dataSkippedCount = 0;
  const skipReasons: Record<string, number> = {};

  for (const d of diagnostics) {
    if (d.tier === "DATA_SKIP") {
      dataSkippedCount += 1;
      const reason = d.rejectionReason ?? "unknown";
      skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
      unavailableCount += 1;
      continue;
    }
    if (d.dataFreshness === "LIVE") liveCount += 1;
    else if (d.dataFreshness === "RECENT") recentCount += 1;
    else if (d.dataFreshness === "CACHED") cachedCount += 1;
    else if (d.dataFreshness === "STALE") staleCount += 1;
    else unavailableCount += 1;
  }

  return {
    liveCount,
    recentCount,
    cachedCount,
    staleCount,
    unavailableCount,
    dataSkippedCount,
    skipReasons,
  };
}
