import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const getAuthUser = vi.fn();
const findBriefByDate = vi.fn();
const listBriefHistory = vi.fn();
const listStoredOpportunities = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: () => getAuthUser(),
}));

vi.mock("@/services/daily-brief", () => ({
  findBriefByDate: (...args: unknown[]) => findBriefByDate(...args),
  listBriefHistory: (...args: unknown[]) => listBriefHistory(...args),
  utcBriefDate: () => "2026-08-25",
}));

vi.mock("@/services/opportunity/persistence", () => ({
  listStoredOpportunities: (...args: unknown[]) =>
    listStoredOpportunities(...args),
}));

import { loadDashboard } from "./load";

describe("loadDashboard", () => {
  beforeEach(() => {
    getAuthUser.mockReset();
    findBriefByDate.mockReset();
    listBriefHistory.mockReset();
    listStoredOpportunities.mockReset();
    listStoredOpportunities.mockResolvedValue([]);
  });

  it("requires authentication", async () => {
    getAuthUser.mockResolvedValue(null);
    await expect(loadDashboard()).resolves.toEqual({ status: "unauthorized" });
    expect(findBriefByDate).not.toHaveBeenCalled();
  });

  it("returns empty when no stored brief exists", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    findBriefByDate.mockResolvedValue(null);
    listBriefHistory.mockResolvedValue([]);
    const result = await loadDashboard(new Date("2026-08-25T12:00:00.000Z"));
    expect(result.status).toBe("empty");
    if (result.status === "empty") {
      expect(result.today).toBe("2026-08-25");
      expect(result.bestStock).toBeNull();
      expect(result.bestCrypto).toBeNull();
    }
  });

  it("returns ok with a mapped view model for a stored brief", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    findBriefByDate.mockResolvedValue({
      id: "b1",
      userId: "user-1",
      briefDate: "2026-08-25",
      timezone: "UTC",
      marketRegime: "MIXED",
      riskEnvironment: "CAUTIOUS",
      summary: "Summary",
      finalStatus: "NO_TRADE",
      marketOverview: [],
      technicalConditions: [],
      tradingSetups: [],
      importantNews: [],
      macroEvents: [],
      aiAnalyses: [],
      topOpportunities: [],
      watchlist: [],
      noTradeAssets: [
        {
          symbol: "NVDA",
          reasons: ["Trend is neutral"],
          rejectReasons: ["NO_TRADE"],
          dataStatus: "LIVE",
        },
      ],
      risks: [],
      dataStatus: "LIVE",
      aiStatus: "SKIPPED",
      model: null,
      promptVersion: "daily-brief-v1",
      isMock: false,
      generatedAt: "2026-08-25T20:00:00.000Z",
      createdAt: "2026-08-25T20:00:00.000Z",
      isStale: false,
    });
    listBriefHistory.mockResolvedValue([]);
    const result = await loadDashboard(new Date("2026-08-25T12:00:00.000Z"));
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.model.decisionStatus).toBe("NO_TRADE");
      expect(result.model.decisionDetail).toBe("Trend is neutral");
      expect(result.bestStock).toBeNull();
      expect(result.bestCrypto).toBeNull();
    }
  });

  it("returns database_unavailable on Supabase failure", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    findBriefByDate.mockRejectedValue(new Error("db down"));
    const result = await loadDashboard();
    expect(result.status).toBe("database_unavailable");
  });
});
