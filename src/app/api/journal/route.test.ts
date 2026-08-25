import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { JournalEntryRecord } from "@/services/journal/types";

const getAuthUser = vi.fn();
const getJournalWorkspace = vi.fn();
const getJournalEntry = vi.fn();
const createManualJournalEntry = vi.fn();
const createJournalFromPaperTrade = vi.fn();
const patchJournalEntry = vi.fn();
const removeJournalEntry = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: () => getAuthUser(),
}));

vi.mock("@/services/journal", () => ({
  getJournalWorkspace: (...args: unknown[]) => getJournalWorkspace(...args),
  getJournalEntry: (...args: unknown[]) => getJournalEntry(...args),
  createManualJournalEntry: (...args: unknown[]) => createManualJournalEntry(...args),
  createJournalFromPaperTrade: (...args: unknown[]) =>
    createJournalFromPaperTrade(...args),
  patchJournalEntry: (...args: unknown[]) => patchJournalEntry(...args),
  removeJournalEntry: (...args: unknown[]) => removeJournalEntry(...args),
  httpStatusForJournalError: (code: string) => {
    if (code === "UNAUTHORIZED") return 401;
    if (code === "INVALID_INPUT") return 400;
    if (code === "NOT_FOUND") return 404;
    if (code === "CONFLICT") return 409;
    return 503;
  },
}));

import { GET, POST } from "./route";
import { GET as GET_ONE, PATCH, DELETE } from "./[id]/route";
import { POST as POST_FROM_TRADE } from "./from-paper-trade/route";

function sampleEntry(): JournalEntryRecord {
  return {
    id: "j1",
    userId: "user-1",
    paperTradeId: null,
    assetId: null,
    symbol: "NVDA",
    side: "LONG",
    entryPrice: 100,
    exitPrice: 110,
    quantity: 10,
    realizedPnL: 100,
    realizedPnLPercent: 10,
    entryTime: "2026-08-25T10:00:00.000Z",
    exitTime: "2026-08-25T12:00:00.000Z",
    setupRating: 8,
    executionRating: 7,
    disciplineRating: 9,
    emotionalState: "Calm",
    mistakeType: null,
    lesson: "Good patience",
    whatWentWell: null,
    whatWentWrong: null,
    notes: null,
    tags: ["process"],
    setupSnapshot: null,
    setupScore: null,
    createdAt: "2026-08-25T12:00:00.000Z",
    updatedAt: "2026-08-25T12:00:00.000Z",
  };
}

describe("journal API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 401 without auth", async () => {
    getAuthUser.mockResolvedValue(null);
    expect((await GET(new NextRequest("http://localhost/api/journal"))).status).toBe(
      401,
    );
  });

  it("GET returns workspace snapshot", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    getJournalWorkspace.mockResolvedValue({
      ok: true,
      data: { entries: [sampleEntry()], statistics: { totalEntries: 1 } },
    });
    const response = await GET(new NextRequest("http://localhost/api/journal"));
    expect(response.status).toBe(200);
  });

  it("POST manual entry validates auth", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    createManualJournalEntry.mockResolvedValue({
      ok: true,
      data: sampleEntry(),
    });
    const response = await POST(
      new NextRequest("http://localhost/api/journal", {
        method: "POST",
        body: JSON.stringify({ notes: "test" }),
      }),
    );
    expect(response.status).toBe(201);
  });

  it("POST from paper trade handles duplicate conflict", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    createJournalFromPaperTrade.mockResolvedValue({
      ok: false,
      code: "CONFLICT",
      error: "Duplicate.",
    });
    const response = await POST_FROM_TRADE(
      new NextRequest("http://localhost/api/journal/from-paper-trade", {
        method: "POST",
        body: JSON.stringify({
          paperTradeId: "550e8400-e29b-41d4-a716-446655440000",
        }),
      }),
    );
    expect(response.status).toBe(409);
  });

  it("blocks foreign journal access", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    getJournalEntry.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      error: "Journal entry not found.",
    });
    expect(
      (
        await GET_ONE(new NextRequest("http://localhost/api/journal/foreign"), {
          params: Promise.resolve({ id: "foreign" }),
        })
      ).status,
    ).toBe(404);
  });

  it("PATCH and DELETE succeed for owned entries", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    patchJournalEntry.mockResolvedValue({ ok: true, data: sampleEntry() });
    removeJournalEntry.mockResolvedValue({ ok: true, data: null });

    expect(
      (
        await PATCH(
          new NextRequest("http://localhost/api/journal/j1", {
            method: "PATCH",
            body: JSON.stringify({ lesson: "Updated" }),
          }),
          { params: Promise.resolve({ id: "j1" }) },
        )
      ).status,
    ).toBe(200);

    expect(
      (
        await DELETE(new NextRequest("http://localhost/api/journal/j1"), {
          params: Promise.resolve({ id: "j1" }),
        })
      ).status,
    ).toBe(204);
  });
});
