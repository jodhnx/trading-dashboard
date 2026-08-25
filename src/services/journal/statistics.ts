import type { JournalEntryRecord, JournalStatistics } from "./types";

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mode(values: string[]): string | null {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export function computeJournalStatistics(
  entries: JournalEntryRecord[],
): JournalStatistics {
  const withPnL = entries.filter((entry) => entry.realizedPnL !== null);
  const wins = withPnL.filter((entry) => (entry.realizedPnL ?? 0) > 0);
  const losses = withPnL.filter((entry) => (entry.realizedPnL ?? 0) < 0);
  const reviewed = entries.filter(
    (entry) =>
      entry.setupRating !== null ||
      entry.executionRating !== null ||
      entry.disciplineRating !== null ||
      entry.notes !== null ||
      entry.lesson !== null,
  );

  const tagCounts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const topTags = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const totalRealizedPnL =
    withPnL.length === 0
      ? null
      : withPnL.reduce((sum, entry) => sum + (entry.realizedPnL ?? 0), 0);

  return {
    totalEntries: entries.length,
    reviewedTrades: reviewed.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate:
      withPnL.length === 0 ? null : (wins.length / withPnL.length) * 100,
    averageRealizedPnL: average(withPnL.map((entry) => entry.realizedPnL!)),
    totalRealizedPnL,
    averageSetupRating: average(
      entries
        .map((entry) => entry.setupRating)
        .filter((value): value is number => value !== null),
    ),
    averageExecutionRating: average(
      entries
        .map((entry) => entry.executionRating)
        .filter((value): value is number => value !== null),
    ),
    averageDisciplineRating: average(
      entries
        .map((entry) => entry.disciplineRating)
        .filter((value): value is number => value !== null),
    ),
    mostCommonMistake: mode(
      entries
        .map((entry) => entry.mistakeType?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
    mostCommonEmotionalState: mode(
      entries
        .map((entry) => entry.emotionalState?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
    topTags,
  };
}
