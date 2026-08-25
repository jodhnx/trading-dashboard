import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PortfolioSnapshot } from "@/services/portfolio/types";

const getAuthUser = vi.fn();
const getPortfolioSnapshot = vi.fn();
const setPortfolioCash = vi.fn();
const addHolding = vi.fn();
const patchHolding = vi.fn();
const removeHolding = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: () => getAuthUser(),
}));

vi.mock("@/services/portfolio", () => ({
  getPortfolioSnapshot: (...args: unknown[]) => getPortfolioSnapshot(...args),
  setPortfolioCash: (...args: unknown[]) => setPortfolioCash(...args),
  addHolding: (...args: unknown[]) => addHolding(...args),
  patchHolding: (...args: unknown[]) => patchHolding(...args),
  removeHolding: (...args: unknown[]) => removeHolding(...args),
  httpStatusForPortfolioError: (code: string) => {
    if (code === "UNAUTHORIZED") return 401;
    if (code === "INVALID_INPUT" || code === "DUPLICATE_HOLDING") return 400;
    if (code === "NOT_FOUND") return 404;
    return 503;
  },
}));

import { GET, PATCH } from "./route";
import { POST } from "./holdings/route";
import { PATCH as PATCH_HOLDING, DELETE } from "./holdings/[id]/route";

function emptyPortfolio(): PortfolioSnapshot {
  return {
    portfolioId: "p1",
    currency: "EUR",
    cash: 0,
    holdings: [],
    totalInvested: 0,
    totalMarketValue: 0,
    totalPortfolioValue: 0,
    unrealizedPnL: 0,
    realizedPnL: null,
    allocation: [
      {
        key: "CASH",
        label: "Cash",
        allocationPercent: null,
        value: 0,
      },
    ],
    dataStatus: "LIVE",
    updatedAt: "2026-08-25T12:00:00.000Z",
  };
}

describe("portfolio API", () => {
  beforeEach(() => {
    getAuthUser.mockReset();
    getPortfolioSnapshot.mockReset();
    setPortfolioCash.mockReset();
    addHolding.mockReset();
    patchHolding.mockReset();
    removeHolding.mockReset();
  });

  it("GET returns 401 without auth", async () => {
    getAuthUser.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(getPortfolioSnapshot).not.toHaveBeenCalled();
  });

  it("GET returns portfolio for the session user", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: "a@b.c" });
    getPortfolioSnapshot.mockResolvedValue({
      ok: true,
      portfolio: emptyPortfolio(),
    });
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.portfolio.portfolioId).toBe("p1");
    expect(getPortfolioSnapshot).toHaveBeenCalledWith({
      userId: "user-1",
      email: "a@b.c",
    });
  });

  it("GET returns 503 when portfolio load fails", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: null });
    getPortfolioSnapshot.mockResolvedValue({
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Unable to load portfolio.",
    });
    const response = await GET();
    expect(response.status).toBe(503);
  });

  it("POST holding returns 401 without auth", async () => {
    getAuthUser.mockResolvedValue(null);
    const response = await POST(
      new NextRequest("http://localhost/api/portfolio/holdings", {
        method: "POST",
        body: JSON.stringify({
          symbol: "NVDA",
          quantity: 1,
          averageEntryPrice: 10,
        }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("POST holding returns 400 for invalid input", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: null });
    addHolding.mockResolvedValue({
      ok: false,
      code: "INVALID_INPUT",
      error: "Must be greater than 0.",
    });
    const response = await POST(
      new NextRequest("http://localhost/api/portfolio/holdings", {
        method: "POST",
        body: JSON.stringify({
          symbol: "NVDA",
          quantity: 0,
          averageEntryPrice: 10,
        }),
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("POST holding returns 400 for duplicates", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: null });
    addHolding.mockResolvedValue({
      ok: false,
      code: "DUPLICATE_HOLDING",
      error: "Holding for this asset already exists.",
    });
    const response = await POST(
      new NextRequest("http://localhost/api/portfolio/holdings", {
        method: "POST",
        body: JSON.stringify({
          symbol: "NVDA",
          quantity: 1,
          averageEntryPrice: 10,
        }),
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "DUPLICATE_HOLDING",
    });
  });

  it("POST holding succeeds", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: null });
    addHolding.mockResolvedValue({
      ok: true,
      portfolio: emptyPortfolio(),
    });
    const response = await POST(
      new NextRequest("http://localhost/api/portfolio/holdings", {
        method: "POST",
        body: JSON.stringify({
          symbol: "NVDA",
          quantity: 1,
          averageEntryPrice: 10,
        }),
      }),
    );
    expect(response.status).toBe(201);
  });

  it("PATCH holding returns 404 for missing/foreign holdings", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: null });
    patchHolding.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      error: "Holding not found.",
    });
    const response = await PATCH_HOLDING(
      new NextRequest("http://localhost/api/portfolio/holdings/h1", {
        method: "PATCH",
        body: JSON.stringify({ quantity: 2 }),
      }),
      { params: Promise.resolve({ id: "foreign-holding" }) },
    );
    expect(response.status).toBe(404);
    expect(patchHolding).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        holdingId: "foreign-holding",
      }),
    );
  });

  it("PATCH holding succeeds", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: null });
    patchHolding.mockResolvedValue({
      ok: true,
      portfolio: emptyPortfolio(),
    });
    const response = await PATCH_HOLDING(
      new NextRequest("http://localhost/api/portfolio/holdings/h1", {
        method: "PATCH",
        body: JSON.stringify({ quantity: 2 }),
      }),
      { params: Promise.resolve({ id: "h1" }) },
    );
    expect(response.status).toBe(200);
  });

  it("DELETE holding returns 404 cross-user", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: null });
    removeHolding.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      error: "Holding not found.",
    });
    const response = await DELETE(
      new NextRequest("http://localhost/api/portfolio/holdings/other", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "other-user-holding" }) },
    );
    expect(response.status).toBe(404);
    expect(removeHolding).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        holdingId: "other-user-holding",
      }),
    );
  });

  it("DELETE holding succeeds", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: null });
    removeHolding.mockResolvedValue({
      ok: true,
      portfolio: emptyPortfolio(),
    });
    const response = await DELETE(
      new NextRequest("http://localhost/api/portfolio/holdings/h1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "h1" }) },
    );
    expect(response.status).toBe(200);
  });

  it("PATCH cash requires auth and validates", async () => {
    getAuthUser.mockResolvedValue(null);
    const unauthorized = await PATCH(
      new NextRequest("http://localhost/api/portfolio", {
        method: "PATCH",
        body: JSON.stringify({ cash: 100 }),
      }),
    );
    expect(unauthorized.status).toBe(401);

    getAuthUser.mockResolvedValue({ id: "user-1", email: null });
    setPortfolioCash.mockResolvedValue({
      ok: false,
      code: "INVALID_INPUT",
      error: "Cash cannot be negative.",
    });
    const bad = await PATCH(
      new NextRequest("http://localhost/api/portfolio", {
        method: "PATCH",
        body: JSON.stringify({ cash: -1 }),
      }),
    );
    expect(bad.status).toBe(400);
  });
});
