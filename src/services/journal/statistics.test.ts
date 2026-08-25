import { describe, expect, it } from "vitest";
import { computeJournalStatistics } from "./statistics";
import type { JournalEntryRecord } from "./types";

function entry(
  partial: Partial<JournalEntryRecord> & Pick<JournalEntryRecord, "id">,
): JournalEntryRecord {
  return {
    id: partial.id,
    userId: "u1",
    paperTradeId: partial.paperTradeId ?? null,
    assetId: partial.assetId ?? null,
    symbol: partial.symbol ?? "NVDA",
    side: partial.side ?? "LONG",
    entryPrice: partial.entryPrice ?? 100,
    exitPrice: partial.exitPrice ?? 110,
    quantity: partial.quantity ?? 10,
    realizedPnL:
      "realizedPnL" in partial ? partial.realizedPnL ?? null : 100,
    realizedPnLPercent: partial.realizedPnLPercent ?? 10,
    entryTime: partial.entryTime ?? "2026-08-25T10:00:00.000Z",
    exitTime: partial.exitTime ?? "2026-08-25T12:00:00.000Z",
    setupRating: partial.setupRating ?? null,
    executionRating: partial.executionRating ?? null,
    disciplineRating: partial.disciplineRating ?? null,
    emotionalState: partial.emotionalState ?? null,
    mistakeType: partial.mistakeType ?? null,
    lesson: partial.lesson ?? null,
    whatWentWell: partial.whatWentWell ?? null,
    whatWentWrong: partial.whatWentWrong ?? null,
    notes: partial.notes ?? null,
    tags: partial.tags ?? [],
    setupSnapshot: partial.setupSnapshot ?? null,
    setupScore: partial.setupScore ?? null,
    createdAt: partial.createdAt ?? "2026-08-25T12:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-08-25T12:00:00.000Z",
  };
}

describe("journal statistics", () => {
  it("computes descriptive win rate from stored P&L only", () => {
    const stats = computeJournalStatistics([
      entry({ id: "1", realizedPnL: 100, setupRating: 8 }),
      entry({ id: "2", realizedPnL: -50, setupRating: 6 }),
      entry({ id: "3", realizedPnL: 25, executionRating: 7 }),
    ]);
    expect(stats.totalEntries).toBe(3);
    expect(stats.winningTrades).toBe(2);
    expect(stats.losingTrades).toBe(1);
    expect(stats.winRate).toBeCloseTo(66.666, 2);
    expect(stats.totalRealizedPnL).toBe(75);
    expect(stats.averageSetupRating).toBeCloseTo(7, 5);
  });

  it("returns null win rate when no P&L is stored", () => {
    const stats = computeJournalStatistics([
      entry({ id: "1", realizedPnL: null, symbol: "SPY" }),
    ]);
    expect(stats.winRate).toBeNull();
    expect(stats.totalRealizedPnL).toBeNull();
  });

  it("finds most common mistake and tags", () => {
    const stats = computeJournalStatistics([
      entry({ id: "1", mistakeType: "Late entry", tags: ["patience"] }),
      entry({ id: "2", mistakeType: "Late entry", tags: ["patience", "fomo"] }),
      entry({ id: "3", emotionalState: "Anxious", tags: ["fomo"] }),
    ]);
    expect(stats.mostCommonMistake).toBe("Late entry");
    expect(stats.topTags[0]?.tag).toBe("patience");
  });
});
