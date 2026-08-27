import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const acquirePipelineLock = vi.fn();
const releasePipelineLock = vi.fn();
const warmMarketData = vi.fn();
const ingestLatestNews = vi.fn();
const listActiveUsers = vi.fn();
const runPipelineAiForUser = vi.fn();
const runPipelineBriefForUser = vi.fn();
const runOpportunityScanForUser = vi.fn();
const createOpenAiClient = vi.fn();

vi.mock("./lock", () => ({
  acquirePipelineLock: (...args: unknown[]) => acquirePipelineLock(...args),
  releasePipelineLock: (...args: unknown[]) => releasePipelineLock(...args),
  defaultPipelineBriefDate: () => "2026-08-25",
}));

vi.mock("./market-step", () => ({
  warmMarketData: (...args: unknown[]) => warmMarketData(...args),
}));

vi.mock("./news-step", () => ({
  ingestLatestNews: (...args: unknown[]) => ingestLatestNews(...args),
}));

vi.mock("./users", () => ({
  listActiveUsers: (...args: unknown[]) => listActiveUsers(...args),
}));

vi.mock("./ai-step", () => ({
  runPipelineAiForUser: (...args: unknown[]) => runPipelineAiForUser(...args),
}));

vi.mock("./brief-step", () => ({
  runPipelineBriefForUser: (...args: unknown[]) => runPipelineBriefForUser(...args),
}));

vi.mock("./opportunity-step", () => ({
  runOpportunityScanForUser: (...args: unknown[]) => runOpportunityScanForUser(...args),
}));

vi.mock("@/ai/create-client", () => ({
  createOpenAiClient: () => createOpenAiClient(),
}));

vi.mock("@/lib/env/server", () => ({
  getRequiredAdminSupabase: () => ({ url: "https://x.supabase.co", secretKey: "secret" }),
}));

vi.mock("./env", () => ({
  validatePipelineEnvironment: () => ({ ok: true, errors: [] }),
}));

vi.mock("@/services/universe/sync-catalog", () => ({
  syncCatalogToDatabase: vi.fn().mockResolvedValue({
    assetsUpserted: 0,
    universeUpserted: 0,
    errors: [],
  }),
}));

import { runDailyPipeline } from "./run-daily";

describe("runDailyPipeline", () => {
  beforeEach(() => {
    acquirePipelineLock.mockReset();
    releasePipelineLock.mockReset();
    warmMarketData.mockReset();
    ingestLatestNews.mockReset();
    listActiveUsers.mockReset();
    runPipelineAiForUser.mockReset();
    runPipelineBriefForUser.mockReset();
    runOpportunityScanForUser.mockReset();
    createOpenAiClient.mockReset();
    createOpenAiClient.mockReturnValue({ isMock: true });
    runOpportunityScanForUser.mockResolvedValue({
      summary: {
        scanned: 23,
        available: 20,
        unavailable: 3,
        liveOrCached: 18,
        strong: 1,
        opportunities: 2,
        watch: 3,
        noTrade: 10,
        topStocks: [{ symbol: "NVDA" }],
        topCrypto: [{ symbol: "BTC" }],
        all: [],
        marketRegime: "BULL",
        noHighConfidence: false,
        boardState: "OPPORTUNITIES_AVAILABLE",
        diagnostics: [
          {
            symbol: "NVDA",
            dataStatus: "LIVE",
            setupDirection: "LONG",
            setupStatus: "VALID",
            technicalScore: 72,
            momentumScore: 70,
            volumeScore: 65,
            newsScore: 60,
            catalystScore: 55,
            sentimentScore: 50,
            regimeScore: 90,
            riskRewardScore: 80,
            finalScore: 72,
            tier: "OPPORTUNITY",
            rejectionReason: null,
          },
        ],
        signalReport: {
          liveAssets: 3,
          validSetups: 3,
          watchCandidates: 0,
          dataSkipped: 0,
          skipReasons: {},
          blockerAggregate: {
            trendBlocked: 0,
            momentumBlocked: 0,
            emaBlocked: 0,
            macdBlocked: 0,
            atrBlocked: 0,
            insufficientData: 0,
            other: 0,
          },
          rejectionReasons: {},
          confirmationSimulation: {
            currentConfirmationRule: "trend + momentum + EMA + MACD",
            activeConfirmationRule: "trend + momentum + (EMA OR MACD)",
            alternativeConfirmationRule: "trend + momentum + EMA + MACD",
            liveOrCachedEvaluated: 3,
            currentValid: 3,
            alternativeValid: 3,
            strongConfirmationCount: 3,
            confirmedCount: 0,
            watchCount: 0,
            note: "test",
          },
          whyNoSetup: [],
          liveDiagnostics: [],
        },
      },
      persisted: { inserted: 3, skipped: 0 },
    });
  });

  it("skips when the lock is not acquired", async () => {
    acquirePipelineLock.mockResolvedValue({
      acquired: false,
      reason: "Pipeline already running",
    });

    const result = await runDailyPipeline({ now: new Date("2026-08-25T05:30:00.000Z") });
    expect(result.status).toBe("SKIPPED");
    expect(warmMarketData).not.toHaveBeenCalled();
  });

  it("runs shared steps once and generates per-user briefs", async () => {
    acquirePipelineLock.mockResolvedValue({ acquired: true, runId: "run-1" });
    warmMarketData.mockResolvedValue({
      assets: [{ symbol: "NVDA", quoteStatus: "LIVE", technicalStatus: "LIVE" }],
      counts: { live: 5, cached: 0, stale: 0, mock: 0, unavailable: 1 },
    });
    ingestLatestNews.mockResolvedValue({
      fetched: true,
      inserted: 3,
      duplicates: 2,
    });
    listActiveUsers.mockResolvedValue([
      { id: "user-1", email: "a@b.c" },
      { id: "user-2", email: "d@e.f" },
    ]);
    runPipelineAiForUser.mockResolvedValue({
      requested: 1,
      completed: 1,
      reused: 0,
      skipped: 5,
      unavailable: 0,
    });
    runPipelineBriefForUser
      .mockResolvedValueOnce({
        userId: "user-1",
        created: true,
        alreadyExists: false,
      })
      .mockResolvedValueOnce({
        userId: "user-2",
        created: false,
        alreadyExists: true,
      });

    const result = await runDailyPipeline({ now: new Date("2026-08-25T05:30:00.000Z") });

    expect(result.status).toBe("PARTIAL");
    expect(warmMarketData).toHaveBeenCalledTimes(1);
    expect(ingestLatestNews).toHaveBeenCalledTimes(1);
    expect(runPipelineAiForUser).toHaveBeenCalledTimes(2);
    expect(runPipelineBriefForUser).toHaveBeenCalledTimes(2);
    expect(result.brief.created).toBe(1);
    expect(result.brief.alreadyExists).toBe(1);
    expect(releasePipelineLock).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", status: "PARTIAL" }),
    );
  });

  it("does not duplicate AI work when fingerprint reuse is reported", async () => {
    acquirePipelineLock.mockResolvedValue({ acquired: true, runId: "run-2" });
    warmMarketData.mockResolvedValue({
      assets: [],
      counts: { live: 6, cached: 0, stale: 0, mock: 0, unavailable: 0 },
    });
    ingestLatestNews.mockResolvedValue({
      fetched: true,
      inserted: 0,
      duplicates: 5,
    });
    listActiveUsers.mockResolvedValue([{ id: "user-1", email: null }]);
    runPipelineAiForUser.mockResolvedValue({
      requested: 0,
      completed: 0,
      reused: 2,
      skipped: 4,
      unavailable: 0,
    });
    runPipelineBriefForUser.mockResolvedValue({
      userId: "user-1",
      created: false,
      alreadyExists: true,
    });

    const first = await runDailyPipeline({ now: new Date("2026-08-25T05:30:00.000Z") });
    const second = await runDailyPipeline({ now: new Date("2026-08-25T06:00:00.000Z") });

    expect(first.ai.reused).toBe(2);
    expect(second.brief.alreadyExists).toBe(1);
  });

  it("continues when news ingestion fails", async () => {
    acquirePipelineLock.mockResolvedValue({ acquired: true, runId: "run-3" });
    warmMarketData.mockResolvedValue({
      assets: [{ symbol: "USD", quoteStatus: "UNAVAILABLE", technicalStatus: "UNAVAILABLE" }],
      counts: { live: 5, cached: 0, stale: 0, mock: 0, unavailable: 1 },
    });
    ingestLatestNews.mockResolvedValue({
      fetched: false,
      inserted: 0,
      duplicates: 0,
      error: "NEWS UNAVAILABLE",
    });
    listActiveUsers.mockResolvedValue([]);
    const result = await runDailyPipeline({ now: new Date("2026-08-25T05:30:00.000Z") });
    expect(result.status).toBe("PARTIAL");
    expect(result.news.fetched).toBe(false);
    expect(releasePipelineLock).toHaveBeenCalled();
  });
});
