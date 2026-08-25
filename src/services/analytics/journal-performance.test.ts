import { describe, expect, it } from "vitest";
import { computeJournalRatingGroups } from "./journal-performance";
import type { JournalEntryRecord } from "@/services/journal/types";

describe("journal analytics", () => {
  it("groups linked journal entries by setup rating", () => {
    const entries: JournalEntryRecord[] = [
      {
        id: "j1",
        userId: "u1",
        paperTradeId: "p1",
        assetId: null,
        symbol: "NVDA",
        side: "LONG",
        entryPrice: null,
        exitPrice: null,
        quantity: null,
        realizedPnL: 100,
        realizedPnLPercent: null,
        entryTime: null,
        exitTime: null,
        setupRating: 5,
        executionRating: 4,
        disciplineRating: 3,
        emotionalState: "Calm",
        mistakeType: "Late entry",
        lesson: null,
        whatWentWell: null,
        whatWentWrong: null,
        notes: null,
        tags: ["process"],
        setupSnapshot: null,
        setupScore: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "j2",
        userId: "u1",
        paperTradeId: "p2",
        assetId: null,
        symbol: "NVDA",
        side: "LONG",
        entryPrice: null,
        exitPrice: null,
        quantity: null,
        realizedPnL: 80,
        realizedPnLPercent: null,
        entryTime: null,
        exitTime: null,
        setupRating: 5,
        executionRating: null,
        disciplineRating: null,
        emotionalState: null,
        mistakeType: null,
        lesson: null,
        whatWentWell: null,
        whatWentWrong: null,
        notes: null,
        tags: [],
        setupSnapshot: null,
        setupScore: null,
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ];
    expect(computeJournalRatingGroups(entries)).toEqual([
      { setupRating: 5, trades: 2, totalRealizedPnL: 180 },
    ]);
  });
});
