import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const findBriefByDate = vi.fn();
const persistBrief = vi.fn();
const assembleDailyBriefInput = vi.fn();
const summarizeDailyBrief = vi.fn();
const createOpenAiClient = vi.fn();

vi.mock("./persistence", () => ({
  findBriefByDate: (...args: unknown[]) => findBriefByDate(...args),
  persistBrief: (...args: unknown[]) => persistBrief(...args),
}));

vi.mock("./assemble", () => ({
  assembleDailyBriefInput: (...args: unknown[]) => assembleDailyBriefInput(...args),
}));

vi.mock("./summarize", () => ({
  summarizeDailyBrief: (...args: unknown[]) => summarizeDailyBrief(...args),
  applySummaryToSnapshot: (
    snapshot: unknown,
    summary: {
      risks: string[];
      aiStatus: string;
      model: string | null;
      promptVersion: string;
    },
  ) => ({
    ...(snapshot as object),
    risks: summary.risks,
    aiStatus: summary.aiStatus,
    model: summary.model,
    promptVersion: summary.promptVersion,
  }),
}));

vi.mock("@/ai/create-client", () => ({
  createOpenAiClient: () => createOpenAiClient(),
}));

import { generateDailyBrief } from "./generate";
import { resetBriefRequests } from "./request-guard";

describe("generateDailyBrief", () => {
  beforeEach(() => {
    resetBriefRequests();
    findBriefByDate.mockReset();
    persistBrief.mockReset();
    assembleDailyBriefInput.mockReset();
    summarizeDailyBrief.mockReset();
    createOpenAiClient.mockReset();
  });

  it("rejects invalid dates", async () => {
    const result = await generateDailyBrief({
      userId: "user-1",
      email: null,
      date: "bad",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_DATE");
    }
  });

  it("prevents duplicates for the same user/date", async () => {
    findBriefByDate.mockResolvedValue({ id: "existing" });
    const result = await generateDailyBrief({
      userId: "user-1",
      email: null,
      date: "2026-08-25",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("BRIEF_EXISTS");
    }
    expect(assembleDailyBriefInput).not.toHaveBeenCalled();
  });

  it("persists even when AI summarization fails", async () => {
    findBriefByDate.mockResolvedValue(null);
    createOpenAiClient.mockReturnValue(null);
    assembleDailyBriefInput.mockResolvedValue({
      snapshot: {
        briefDate: "2026-08-25",
        timezone: "UTC",
        timeframe: "1day",
        generatedAt: "2026-08-25T12:00:00.000Z",
        symbols: ["NVDA"],
        marketOverview: [],
        technicalConditions: [],
        tradingSetups: [],
        importantNews: [],
        macroEvents: [],
        aiAnalyses: [],
        topOpportunities: [],
        watchlist: [],
        noTradeAssets: [],
        risks: [],
        dataStatus: "LIVE",
        newsStatus: "UNAVAILABLE",
        aiStatus: "SKIPPED",
        model: null,
        promptVersion: "daily-brief-v1",
      },
      marketRegime: "MIXED",
      riskEnvironment: "CAUTIOUS",
      summary: "Deterministic",
      finalStatus: "NO_TRADE",
    });
    summarizeDailyBrief.mockResolvedValue({
      summary: "Deterministic",
      marketRegime: "MIXED",
      riskEnvironment: "CAUTIOUS",
      risks: ["AI unavailable"],
      aiStatus: "AI_UNAVAILABLE",
      model: null,
      promptVersion: "daily-brief-summary-v1",
      notes: [],
    });
    persistBrief.mockResolvedValue({
      id: "b1",
      briefDate: "2026-08-25",
      finalStatus: "NO_TRADE",
      summary: "Deterministic",
      aiStatus: "AI_UNAVAILABLE",
    });

    const result = await generateDailyBrief({
      userId: "user-1",
      email: "a@b.c",
      date: "2026-08-25",
      now: new Date("2026-08-25T12:00:00.000Z"),
    });
    expect(result.ok).toBe(true);
    expect(persistBrief).toHaveBeenCalled();
  });
});
