import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAnalyticsViewModel } from "./service";

vi.mock("server-only", () => ({}));

const loadPaperAccount = vi.fn();
const loadClosedPaperTrades = vi.fn();
const loadOpenPaperPositions = vi.fn();
const loadJournalEntries = vi.fn();
const loadBacktestRuns = vi.fn();

vi.mock("./persistence", () => ({
  loadPaperAccount: (...args: unknown[]) => loadPaperAccount(...args),
  loadClosedPaperTrades: (...args: unknown[]) => loadClosedPaperTrades(...args),
  loadOpenPaperPositions: (...args: unknown[]) => loadOpenPaperPositions(...args),
  loadJournalEntries: (...args: unknown[]) => loadJournalEntries(...args),
  loadBacktestRuns: (...args: unknown[]) => loadBacktestRuns(...args),
}));

describe("analytics service", () => {
  beforeEach(() => {
    loadPaperAccount.mockReset();
    loadClosedPaperTrades.mockReset();
    loadOpenPaperPositions.mockReset();
    loadJournalEntries.mockReset();
    loadBacktestRuns.mockReset();
    loadPaperAccount.mockResolvedValue({
      starting_balance: 10000,
      cash_balance: 10000,
    });
    loadClosedPaperTrades.mockResolvedValue([]);
    loadOpenPaperPositions.mockResolvedValue([]);
    loadJournalEntries.mockResolvedValue([]);
    loadBacktestRuns.mockResolvedValue([]);
  });

  it("rejects invalid filters", async () => {
    const result = await getAnalyticsViewModel({
      userId: "user-1",
      query: { preset: "30D", from: "2026-01-01", to: "2026-06-01" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_FILTER");
    }
  });

  it("returns analytics view model without provider calls", async () => {
    const result = await getAnalyticsViewModel({
      userId: "user-1",
      query: { dataset: "all", preset: "ALL" },
      referenceDate: new Date("2026-08-24T12:00:00.000Z"),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.paper.hasData).toBe(false);
      expect(result.data.backtest.hasSavedResults).toBe(false);
    }
  });

  it("is deterministic for the same mocked data", async () => {
    loadClosedPaperTrades.mockResolvedValue([
      {
        id: "t1",
        userId: "user-1",
        positionId: "p1",
        assetId: "a1",
        symbol: "NVDA",
        side: "LONG",
        entryPrice: 100,
        exitPrice: 110,
        quantity: 1,
        riskAmount: 5,
        pnl: 10,
        pnlPercent: 10,
        stopLoss: 95,
        takeProfit: 115,
        setupScore: 70,
        setupSnapshot: null,
        status: "CLOSED",
        closeReason: "TAKE_PROFIT",
        openedAt: "2026-01-01T00:00:00.000Z",
        closedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    const first = await getAnalyticsViewModel({
      userId: "user-1",
      query: { dataset: "paper", preset: "ALL" },
    });
    const second = await getAnalyticsViewModel({
      userId: "user-1",
      query: { dataset: "paper", preset: "ALL" },
    });
    expect(first).toEqual(second);
  });
});
