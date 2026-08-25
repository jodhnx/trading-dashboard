import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const insertJournalEntry = vi.fn();
const findJournalByPaperTradeId = vi.fn();
const findClosedPaperTrade = vi.fn();
const findJournalEntryById = vi.fn();

vi.mock("./persistence", () => ({
  insertJournalEntry: (...args: unknown[]) => insertJournalEntry(...args),
  findJournalByPaperTradeId: (...args: unknown[]) => findJournalByPaperTradeId(...args),
  findClosedPaperTrade: (...args: unknown[]) => findClosedPaperTrade(...args),
  findJournalEntryById: (...args: unknown[]) => findJournalEntryById(...args),
  findAssetBySymbol: vi.fn(),
  listJournalEntries: vi.fn(),
  updateJournalEntry: vi.fn(),
  deleteJournalEntry: vi.fn(),
  listJournalPaperTradeIds: vi.fn(),
  mapJournalRow: vi.fn(),
}));

import {
  createJournalFromPaperTrade,
  patchJournalEntry,
  removeJournalEntry,
} from "./service";

describe("journal service security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects duplicate journal entries for the same paper trade", async () => {
    findJournalByPaperTradeId.mockResolvedValue({ id: "existing" });
    const result = await createJournalFromPaperTrade({
      userId: "user-1",
      body: { paperTradeId: "550e8400-e29b-41d4-a716-446655440000" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CONFLICT");
  });

  it("copies immutable trade facts from closed paper trade", async () => {
    findJournalByPaperTradeId.mockResolvedValue(null);
    findClosedPaperTrade.mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
      asset_id: "asset-1",
      side: "LONG",
      entry_price: 212,
      exit_price: 225,
      quantity: 10,
      pnl: 130,
      pnl_percent: 6.1,
      setup_score: 8.5,
      setup_snapshot: { symbol: "NVDA", entry: 212 },
      opened_at: "2026-08-25T10:00:00.000Z",
      closed_at: "2026-08-25T12:00:00.000Z",
      symbol: "NVDA",
    });
    insertJournalEntry.mockResolvedValue({
      id: "j1",
      userId: "user-1",
      symbol: "NVDA",
    });

    const result = await createJournalFromPaperTrade({
      userId: "user-1",
      body: {
        paperTradeId: "550e8400-e29b-41d4-a716-446655440000",
        setupRating: 8,
      },
    });
    expect(result.ok).toBe(true);
    expect(insertJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        row: expect.objectContaining({
          entry_price: 212,
          exit_price: 225,
          realized_pnl: 130,
          paper_trade_id: "550e8400-e29b-41d4-a716-446655440000",
        }),
      }),
    );
  });

  it("blocks cross-user journal patch/delete", async () => {
    findJournalEntryById.mockResolvedValue(null);
    expect(
      (await patchJournalEntry({
        userId: "user-1",
        entryId: "foreign",
        body: { lesson: "nope" },
      })).ok,
    ).toBe(false);
    expect(
      (await removeJournalEntry({
        userId: "user-1",
        entryId: "foreign",
      })).ok,
    ).toBe(false);
  });
});
