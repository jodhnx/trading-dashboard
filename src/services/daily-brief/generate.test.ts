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

  it("propagates admin persistence through cron brief generation", async () => {
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
      risks: [],
      aiStatus: "AI_UNAVAILABLE",
      model: null,
      promptVersion: "daily-brief-summary-v1",
      notes: [],
    });
    persistBrief.mockResolvedValue({ id: "b1" });

    await generateDailyBrief({
      userId: "user-1",
      email: null,
      date: "2026-08-25",
      persistence: "admin",
    });

    expect(findBriefByDate).toHaveBeenCalledWith(
      expect.objectContaining({ persistence: "admin" }),
    );
    expect(assembleDailyBriefInput).toHaveBeenCalledWith(
      expect.objectContaining({ persistence: "admin" }),
    );
    expect(persistBrief).toHaveBeenCalledWith(
      expect.objectContaining({ persistence: "admin" }),
    );
  });

  it("logs assemble failures without exposing secrets in the API response", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    findBriefByDate.mockResolvedValue(null);
    assembleDailyBriefInput.mockRejectedValue(new Error("Could not create profile."));

    const result = await generateDailyBrief({
      userId: "user-1",
      email: "secret@example.com",
      date: "2026-08-25",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("DATA_UNAVAILABLE");
      expect(result.error).toBe("Failed to assemble market or settings data");
    }
    expect(errorSpy).toHaveBeenCalledWith(
      "[daily-brief] assemble failed",
      expect.objectContaining({
        userId: "user-1",
        briefDate: "2026-08-25",
        reason: "Could not create profile.",
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(/secret@example.com/);
    errorSpy.mockRestore();
  });
});
