import { computeJournalStatistics } from "@/services/journal/statistics";
import type { JournalEntryRecord } from "@/services/journal/types";
import type { JournalAnalyticsSection, JournalRatingGroup } from "./types";
import { average, sum } from "./drawdown";

export function computeJournalRatingGroups(
  entries: JournalEntryRecord[],
): JournalRatingGroup[] {
  const groups = new Map<number, JournalEntryRecord[]>();
  for (const entry of entries) {
    if (entry.setupRating === null || entry.paperTradeId === null) {
      continue;
    }
    const rating = Math.round(entry.setupRating);
    const list = groups.get(rating) ?? [];
    list.push(entry);
    groups.set(rating, list);
  }

  return [...groups.entries()]
    .map(([setupRating, grouped]) => {
      const withPnL = grouped.filter((entry) => entry.realizedPnL !== null);
      return {
        setupRating,
        trades: withPnL.length,
        totalRealizedPnL: sum(withPnL.map((entry) => entry.realizedPnL!)),
      };
    })
    .sort((a, b) => a.setupRating - b.setupRating);
}

export function buildJournalAnalyticsSection(
  entries: JournalEntryRecord[],
): JournalAnalyticsSection {
  const statistics = computeJournalStatistics(entries);
  return {
    hasData: entries.length > 0,
    totalEntries: statistics.totalEntries,
    reviewedTrades: statistics.reviewedTrades,
    averageSetupRating: statistics.averageSetupRating,
    averageExecutionRating: statistics.averageExecutionRating,
    averageDisciplineRating: statistics.averageDisciplineRating,
    mostCommonMistake: statistics.mostCommonMistake,
    mostCommonEmotionalState: statistics.mostCommonEmotionalState,
    topTags: statistics.topTags,
    ratingGroups: computeJournalRatingGroups(entries),
  };
}

export { average };
