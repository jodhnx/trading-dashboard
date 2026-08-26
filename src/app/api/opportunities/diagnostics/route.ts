import { getAuthUser } from "@/lib/auth/session";
import { utcBriefDate } from "@/services/daily-brief/date";
import { loadPipelineOpportunityBoardMeta } from "@/services/opportunity/board-meta";
import { listStoredOpportunities } from "@/services/opportunity/persistence";
import { toProviderSymbol } from "@/services/market/symbols";
import {
  listCryptoUniverse,
  listStockUniverse,
  OPPORTUNITY_UNIVERSE,
} from "@/services/opportunity/universe";
import {
  ACTIVE_CONFIRMATION_RULE,
  LEGACY_CONFIRMATION_RULE,
} from "@/engine/trading/confirmation";

/**
 * Authenticated diagnostics for opportunity signal generation.
 * Never returns secrets, API keys, or user PII beyond the caller's own scan context.
 */
export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? utcBriefDate();
  const meta = await loadPipelineOpportunityBoardMeta(date);
  const stored = await listStoredOpportunities({
    userId: user.id,
    briefDate: date,
    limit: 40,
  });

  const validStored = stored.filter(
    (item) =>
      item.tier === "STRONG_OPPORTUNITY" || item.tier === "OPPORTUNITY",
  );
  const watchStored = stored.filter((item) => item.tier === "WATCH");

  const signal = meta.signalReport;
  const boardState =
    meta.boardState ??
    (validStored.length > 0
      ? "OPPORTUNITIES_AVAILABLE"
      : watchStored.length > 0
        ? "WATCH_ONLY"
        : meta.scanned
          ? "NO_TRADE"
          : "DATA_INSUFFICIENT");

  const sim = signal?.confirmationSimulation;

  return Response.json({
    ok: true,
    date,
    boardState,
    marketRegime: meta.marketRegime ?? stored[0]?.marketRegime ?? "UNKNOWN",
    liveAssets: signal?.liveAssets ?? 0,
    validSetups: signal?.validSetups ?? validStored.length,
    watchCandidates: signal?.watchCandidates ?? watchStored.length,
    dataSkipped: signal?.dataSkipped ?? 0,
    skipReasons: signal?.skipReasons ?? {},
    rejectionReasons: signal?.rejectionReasons ?? {},
    blockerAggregate: signal?.blockerAggregate ?? {
      trendBlocked: 0,
      momentumBlocked: 0,
      emaBlocked: 0,
      macdBlocked: 0,
      atrBlocked: 0,
      insufficientData: 0,
      other: 0,
    },
    currentConfirmationRule:
      sim?.currentConfirmationRule ?? LEGACY_CONFIRMATION_RULE,
    activeConfirmationRule:
      sim?.activeConfirmationRule ?? ACTIVE_CONFIRMATION_RULE,
    alternativeConfirmationRule:
      sim?.alternativeConfirmationRule ?? LEGACY_CONFIRMATION_RULE,
    strongConfirmationCount: sim?.strongConfirmationCount ?? 0,
    confirmedCount: sim?.confirmedCount ?? 0,
    watchCount: sim?.watchCount ?? watchStored.length,
    confirmationSimulation: sim ?? null,
    whyNoSetup: signal?.whyNoSetup ?? [
      meta.scanned
        ? "Scan completed but no signal report was stored. Re-run the daily pipeline."
        : "No completed pipeline scan for this UTC day.",
    ],
    liveDiagnostics: signal?.liveDiagnostics ?? [],
    universe: {
      stocks: listStockUniverse()
        .filter((a) => a.assetClass === "STOCK" || a.assetClass === "ETF")
        .map((a) => ({
          symbol: a.symbol,
          providerSymbol: toProviderSymbol(a.symbol),
          mapped: toProviderSymbol(a.symbol) !== null,
        })),
      crypto: listCryptoUniverse().map((a) => ({
        symbol: a.symbol,
        providerSymbol: toProviderSymbol(a.symbol),
        mapped: toProviderSymbol(a.symbol) !== null,
      })),
      total: OPPORTUNITY_UNIVERSE.length,
    },
    freshness: {
      liveCount: meta.signalReport?.liveAssets ?? 0,
      cachedCount: 0,
      staleCount: 0,
      unavailableCount: 0,
      dataSkippedCount: signal?.dataSkipped ?? 0,
      skipReasons: signal?.skipReasons ?? {},
    },
    schedulerNote:
      "Vercel Hobby supports one cron job; daily scan covers universe/news/regime/ranking. Real-time exit monitoring needs an external/hourly scheduler — daily data is not real-time.",
    disclaimer:
      "Diagnostics only. Active confirmation rule is trend + momentum + (EMA OR MACD). Phase 22 ranks EARLY_SETUP without forcing trades.",
  });
}
