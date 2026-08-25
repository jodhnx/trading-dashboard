import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getTechnicalSnapshot = vi.fn();
const listNews = vi.fn();
const findAnalysisByFingerprint = vi.fn();
const findAssetIdBySymbol = vi.fn();
const persistAnalysis = vi.fn();
const analyzeTradingSetup = vi.fn();
const getOrCreateAccountSettings = vi.fn();
const createOpenAiClient = vi.fn();

vi.mock("@/services/market/create-service", () => ({
  createMarketDataService: () => ({
    getTechnicalSnapshot: (...args: unknown[]) => getTechnicalSnapshot(...args),
  }),
}));

vi.mock("@/services/news/create-service", () => ({
  createNewsService: () => ({
    listNews: (...args: unknown[]) => listNews(...args),
  }),
}));

vi.mock("@/services/ai/persistence", () => ({
  findAnalysisByFingerprint: (...args: unknown[]) => findAnalysisByFingerprint(...args),
  findAssetIdBySymbol: (...args: unknown[]) => findAssetIdBySymbol(...args),
  persistAnalysis: (...args: unknown[]) => persistAnalysis(...args),
}));

vi.mock("@/ai/analyze", () => ({
  analyzeTradingSetup: (...args: unknown[]) => analyzeTradingSetup(...args),
}));

vi.mock("@/lib/settings/service", () => ({
  getOrCreateAccountSettings: (...args: unknown[]) => getOrCreateAccountSettings(...args),
}));

vi.mock("@/ai/create-client", () => ({
  createOpenAiClient: () => createOpenAiClient(),
}));

import { liveSnapshot } from "@/ai/test-fixtures";
import { runPipelineAiForUser } from "./ai-step";

describe("runPipelineAiForUser", () => {
  beforeEach(() => {
    getTechnicalSnapshot.mockReset();
    listNews.mockReset();
    findAnalysisByFingerprint.mockReset();
    findAssetIdBySymbol.mockReset();
    persistAnalysis.mockReset();
    analyzeTradingSetup.mockReset();
    getOrCreateAccountSettings.mockReset();
    createOpenAiClient.mockReset();

    getOrCreateAccountSettings.mockResolvedValue({
      capital: 10_000,
      riskPerTradePercent: 1,
      maxPositionPercent: 20,
      minimumRiskReward: 2,
    });
    createOpenAiClient.mockReturnValue({ isMock: false });
    listNews.mockResolvedValue({ items: [] });
    findAnalysisByFingerprint.mockResolvedValue(null);
    findAssetIdBySymbol.mockResolvedValue("asset-nvda");
  });

  it("skips OpenAI when market data is unavailable", async () => {
    getTechnicalSnapshot.mockResolvedValue({
      snapshot: liveSnapshot({ dataStatus: "UNAVAILABLE" }),
    });

    const result = await runPipelineAiForUser({
      userId: "user-1",
      email: null,
      client: { isMock: false, completeStructured: vi.fn() } as never,
    });

    expect(result.skipped).toBe(6);
    expect(analyzeTradingSetup).not.toHaveBeenCalled();
  });

  it("reuses an existing analysis for the same fingerprint", async () => {
    getTechnicalSnapshot.mockImplementation(async (symbol: string) => ({
      snapshot:
        symbol === "NVDA"
          ? liveSnapshot()
          : liveSnapshot({ symbol, dataStatus: "UNAVAILABLE" }),
    }));
    findAnalysisByFingerprint.mockResolvedValue({ id: "existing" });

    const result = await runPipelineAiForUser({
      userId: "user-1",
      email: null,
      client: { isMock: false, completeStructured: vi.fn() } as never,
    });

    expect(result.reused).toBe(1);
    expect(analyzeTradingSetup).not.toHaveBeenCalled();
  });

  it("marks AI unavailable without failing the step", async () => {
    getTechnicalSnapshot.mockImplementation(async (symbol: string) => ({
      snapshot:
        symbol === "NVDA"
          ? liveSnapshot()
          : liveSnapshot({ symbol, dataStatus: "UNAVAILABLE" }),
    }));
    analyzeTradingSetup.mockResolvedValue({
      ok: false,
      code: "AI_UNAVAILABLE",
      error: "quota exceeded",
    });

    const result = await runPipelineAiForUser({
      userId: "user-1",
      email: null,
      client: { isMock: false, completeStructured: vi.fn() } as never,
    });

    expect(result.unavailable).toBe(1);
    expect(persistAnalysis).not.toHaveBeenCalled();
  });
});
