import "server-only";

import { USER_SETTINGS_DEFAULTS } from "@/types/settings";
import { resolveAnalyticsDateRange } from "./date";
import { buildBacktestAnalyticsSection } from "./backtest-performance";
import { buildJournalAnalyticsSection } from "./journal-performance";
import {
  buildPaperEquityCurve,
  computePaperPerformanceSummary,
  groupPaperTradesByAsset,
  groupPaperTradesByExitReason,
  groupPaperTradesByScore,
  groupPaperTradesBySide,
} from "./paper-performance";
import {
  loadBacktestRuns,
  loadClosedPaperTrades,
  loadJournalEntries,
  loadOpenPaperPositions,
  loadPaperAccount,
} from "./persistence";
import type {
  AnalyticsErrorCode,
  AnalyticsViewModel,
  PaperAnalyticsSection,
} from "./types";
import { analyticsQuerySchema } from "./validation";

export type AnalyticsResult =
  | { ok: true; data: AnalyticsViewModel }
  | { ok: false; code: AnalyticsErrorCode; error: string };

function emptyPaperSection(startingBalance: number): PaperAnalyticsSection {
  const summary = computePaperPerformanceSummary({
    startingBalance,
    cash: startingBalance,
    closedTrades: [],
    openPositions: [],
  });
  return {
    hasData: false,
    summary,
    equityCurve: [],
    byAsset: [],
    bySide: groupPaperTradesBySide([]),
    byScore: groupPaperTradesByScore([]),
    byExitReason: groupPaperTradesByExitReason([]),
  };
}

export async function getAnalyticsViewModel(input: {
  userId: string;
  query?: Record<string, string | undefined>;
  referenceDate?: Date;
}): Promise<AnalyticsResult> {
  const parsed = analyticsQuerySchema.safeParse(input.query ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_FILTER",
      error: parsed.error.issues[0]?.message ?? "Invalid analytics filter.",
    };
  }

  try {
    const range = resolveAnalyticsDateRange({
      preset: parsed.data.preset,
      from: parsed.data.from,
      to: parsed.data.to,
      referenceDate: input.referenceDate,
    });
    const symbol = parsed.data.symbol ?? "ALL";
    const dataset = parsed.data.dataset ?? "all";

    const account = await loadPaperAccount({ userId: input.userId });
    const startingBalance = account
      ? Number(account.starting_balance)
      : USER_SETTINGS_DEFAULTS.capital;
    const cash = account ? Number(account.cash_balance) : startingBalance;

    let paper = emptyPaperSection(startingBalance);
    if (dataset === "paper" || dataset === "all") {
      const [closedTrades, openPositions] = await Promise.all([
        loadClosedPaperTrades({ userId: input.userId, range, symbol }),
        loadOpenPaperPositions({ userId: input.userId, symbol }),
      ]);
      const summary = computePaperPerformanceSummary({
        startingBalance,
        cash,
        closedTrades,
        openPositions,
      });
      paper = {
        hasData: closedTrades.length > 0,
        summary,
        equityCurve: buildPaperEquityCurve({
          startingBalance,
          closedTrades: closedTrades.map((trade) => ({
            closedAt: trade.closedAt,
            pnl: trade.pnl,
          })),
        }),
        byAsset: groupPaperTradesByAsset(closedTrades),
        bySide: groupPaperTradesBySide(closedTrades),
        byScore: groupPaperTradesByScore(closedTrades),
        byExitReason: groupPaperTradesByExitReason(closedTrades),
      };
    }

    let journal = buildJournalAnalyticsSection([]);
    if (dataset === "journal" || dataset === "all") {
      const entries = await loadJournalEntries({
        userId: input.userId,
        range,
        symbol,
      });
      journal = buildJournalAnalyticsSection(entries);
    }

    let backtest = buildBacktestAnalyticsSection({ runs: [] });
    if (dataset === "backtest" || dataset === "all") {
      const runs = await loadBacktestRuns({ userId: input.userId });
      backtest = buildBacktestAnalyticsSection({ runs });
    }

    return {
      ok: true,
      data: {
        filters: {
          ...range,
          symbol,
          dataset,
        },
        paper,
        journal,
        backtest,
      },
    };
  } catch {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Unable to load analytics.",
    };
  }
}

export function httpStatusForAnalyticsError(code: AnalyticsErrorCode): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "INVALID_FILTER":
      return 400;
    default:
      return 503;
  }
}
