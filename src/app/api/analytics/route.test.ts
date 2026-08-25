import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: vi.fn(),
}));

vi.mock("@/services/analytics", () => ({
  getAnalyticsViewModel: vi.fn(),
  httpStatusForAnalyticsError: (code: string) => {
    if (code === "UNAUTHORIZED") return 401;
    if (code === "INVALID_FILTER") return 400;
    return 503;
  },
}));

import { getAuthUser } from "@/lib/auth/session";
import { getAnalyticsViewModel } from "@/services/analytics";

describe("GET /api/analytics", () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockReset();
    vi.mocked(getAnalyticsViewModel).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const response = await GET(new NextRequest("http://localhost/api/analytics"));
    expect(response.status).toBe(401);
  });

  it("returns analytics payload", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "a@b.c" } as never);
    vi.mocked(getAnalyticsViewModel).mockResolvedValue({
      ok: true,
      data: {
        filters: { preset: "ALL", from: null, to: null, symbol: "ALL", dataset: "all" },
        paper: {
          hasData: false,
          summary: {
            startingBalance: 10000,
            cash: 10000,
            equity: 10000,
            realizedPnL: null,
            unrealizedPnL: 0,
            totalReturn: null,
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: null,
            averageWinningTrade: null,
            averageLosingTrade: null,
            averageTrade: null,
            largestWinner: null,
            largestLoser: null,
            grossProfit: null,
            grossLoss: null,
            profitFactor: null,
            maxDrawdown: null,
            averageRiskReward: null,
          },
          equityCurve: [],
          byAsset: [],
          bySide: [],
          byScore: [],
          byExitReason: [],
        },
        journal: {
          hasData: false,
          totalEntries: 0,
          reviewedTrades: 0,
          averageSetupRating: null,
          averageExecutionRating: null,
          averageDisciplineRating: null,
          mostCommonMistake: null,
          mostCommonEmotionalState: null,
          topTags: [],
          ratingGroups: [],
        },
        backtest: { hasSavedResults: false, runs: [] },
      },
    });
    const response = await GET(
      new NextRequest("http://localhost/api/analytics?dataset=all"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { paper: { hasData: boolean } };
    expect(payload.paper.hasData).toBe(false);
  });
});
