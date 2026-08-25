import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PaperAccountSnapshot } from "@/services/paper/types";

const getAuthUser = vi.fn();
const getPaperAccountSnapshot = vi.fn();
const getOpenPaperPositions = vi.fn();
const getPaperTradeHistory = vi.fn();
const openPaperTrade = vi.fn();
const closePaperPosition = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: () => getAuthUser(),
}));

vi.mock("@/services/paper", () => ({
  getPaperAccountSnapshot: (...args: unknown[]) => getPaperAccountSnapshot(...args),
  getOpenPaperPositions: (...args: unknown[]) => getOpenPaperPositions(...args),
  getPaperTradeHistory: (...args: unknown[]) => getPaperTradeHistory(...args),
  openPaperTrade: (...args: unknown[]) => openPaperTrade(...args),
  closePaperPosition: (...args: unknown[]) => closePaperPosition(...args),
  httpStatusForPaperError: (code: string) => {
    if (code === "UNAUTHORIZED") return 401;
    if (
      code === "INVALID_INPUT" ||
      code === "INVALID_TRADING_SETUP" ||
      code === "INSUFFICIENT_CASH"
    ) {
      return 400;
    }
    if (code === "NOT_FOUND") return 404;
    if (code === "DUPLICATE_OPEN_POSITION" || code === "CONFLICT") return 409;
    return 503;
  },
}));

import { GET } from "./route";
import { POST } from "./open/route";
import { GET as GET_POSITIONS } from "./positions/route";
import { GET as GET_TRADES } from "./trades/route";
import { POST as POST_CLOSE } from "./positions/[id]/close/route";

function emptyAccount(): PaperAccountSnapshot {
  return {
    accountId: "a1",
    startingBalance: 10000,
    cashBalance: 10000,
    equity: 10000,
    invested: 0,
    unrealizedPnL: 0,
    realizedPnL: 0,
    openPositions: [],
    closedTrades: [],
    dataStatus: "LIVE",
    updatedAt: "2026-08-25T12:00:00.000Z",
  };
}

describe("paper API", () => {
  beforeEach(() => {
    getAuthUser.mockReset();
    getPaperAccountSnapshot.mockReset();
    getOpenPaperPositions.mockReset();
    getPaperTradeHistory.mockReset();
    openPaperTrade.mockReset();
    closePaperPosition.mockReset();
  });

  it("GET /api/paper returns 401 without auth", async () => {
    getAuthUser.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("GET /api/paper returns account snapshot", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    getPaperAccountSnapshot.mockResolvedValue({
      ok: true,
      account: emptyAccount(),
    });
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it("POST /api/paper/open validates auth and setup failures", async () => {
    getAuthUser.mockResolvedValue(null);
    expect((await POST(new NextRequest("http://localhost/api/paper/open", { method: "POST", body: "{}" }))).status).toBe(401);

    getAuthUser.mockResolvedValue({ id: "user-1", email: null });
    openPaperTrade.mockResolvedValue({
      ok: false,
      code: "INVALID_TRADING_SETUP",
      error: "Setup status is REJECTED.",
    });
    const bad = await POST(
      new NextRequest("http://localhost/api/paper/open", {
        method: "POST",
        body: JSON.stringify({ symbol: "NVDA", timeframe: "1day" }),
      }),
    );
    expect(bad.status).toBe(400);
  });

  it("POST /api/paper/open succeeds", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: null });
    openPaperTrade.mockResolvedValue({ ok: true, account: emptyAccount() });
    const response = await POST(
      new NextRequest("http://localhost/api/paper/open", {
        method: "POST",
        body: JSON.stringify({ symbol: "NVDA", timeframe: "1day" }),
      }),
    );
    expect(response.status).toBe(201);
  });

  it("GET positions and trades require auth", async () => {
    getAuthUser.mockResolvedValue(null);
    expect((await GET_POSITIONS()).status).toBe(401);
    expect((await GET_TRADES()).status).toBe(401);
  });

  it("POST close blocks foreign positions", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    closePaperPosition.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      error: "Position not found.",
    });
    const response = await POST_CLOSE(
      new NextRequest("http://localhost/api/paper/positions/other/close", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "foreign" }) },
    );
    expect(response.status).toBe(404);
    expect(closePaperPosition).toHaveBeenCalledWith({
      userId: "user-1",
      positionId: "foreign",
    });
  });

  it("POST close succeeds", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    closePaperPosition.mockResolvedValue({ ok: true, account: emptyAccount() });
    const response = await POST_CLOSE(
      new NextRequest("http://localhost/api/paper/positions/p1/close", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "p1" }) },
    );
    expect(response.status).toBe(200);
  });

  it("handles duplicate and insufficient cash errors", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: null });
    openPaperTrade.mockResolvedValueOnce({
      ok: false,
      code: "DUPLICATE_OPEN_POSITION",
      error: "Duplicate.",
    });
    expect(
      (
        await POST(
          new NextRequest("http://localhost/api/paper/open", {
            method: "POST",
            body: JSON.stringify({ symbol: "NVDA", timeframe: "1day" }),
          }),
        )
      ).status,
    ).toBe(409);

    openPaperTrade.mockResolvedValueOnce({
      ok: false,
      code: "INSUFFICIENT_CASH",
      error: "Insufficient cash.",
    });
    expect(
      (
        await POST(
          new NextRequest("http://localhost/api/paper/open", {
            method: "POST",
            body: JSON.stringify({ symbol: "NVDA", timeframe: "1day" }),
          }),
        )
      ).status,
    ).toBe(400);
  });
});
