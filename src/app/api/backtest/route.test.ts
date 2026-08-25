import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: vi.fn(),
}));

vi.mock("@/services/backtest", () => ({
  runBacktest: vi.fn(),
  httpStatusForBacktestError: (code: string) => {
    if (code === "UNAUTHORIZED") return 401;
    if (code === "INVALID_INPUT") return 400;
    if (code === "ASSET_NOT_FOUND") return 404;
    if (code === "RANGE_TOO_LARGE" || code === "INVALID_DATA") return 422;
    return 503;
  },
}));

import { getAuthUser } from "@/lib/auth/session";
import { runBacktest } from "@/services/backtest";

describe("POST /api/backtest", () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockReset();
    vi.mocked(runBacktest).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const response = await POST(
      new Request("http://localhost/api/backtest", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "a@b.c" } as never);
    const response = await POST(
      new Request("http://localhost/api/backtest", {
        method: "POST",
        body: "{",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("returns backtest result on success", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "a@b.c" } as never);
    vi.mocked(runBacktest).mockResolvedValue({
      ok: true,
      data: {
        symbol: "NVDA",
        timeframe: "1day",
        from: "2024-01-01",
        to: "2024-06-01",
        startingCapital: 10000,
        endingCapital: 10000,
        totalReturn: 0,
        totalPnL: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: null,
        averageTradePnL: null,
        maxDrawdown: 0,
        profitFactor: null,
        averageRiskReward: null,
        dataStatus: "MOCK",
        feesSlippageModeled: false,
        trades: [],
        equityCurve: [],
      },
    });
    const response = await POST(
      new Request("http://localhost/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: "NVDA",
          timeframe: "1day",
          from: "2024-01-01",
          to: "2024-06-01",
          startingCapital: 10000,
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { result: { symbol: string } };
    expect(payload.result.symbol).toBe("NVDA");
  });
});
