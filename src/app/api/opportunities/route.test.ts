import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: vi.fn(),
}));

vi.mock("@/services/opportunity/persistence", () => ({
  listStoredOpportunities: vi.fn(async () => []),
}));

vi.mock("@/services/opportunity/board-meta", () => ({
  loadPipelineOpportunityBoardMeta: vi.fn(async () => ({
    boardState: null,
    marketRegime: null,
    liveOrCached: null,
    scanned: false,
    signalReport: null,
  })),
}));

vi.mock("@/services/opportunity/board-response", () => ({
  buildOpportunitiesBoardResponse: vi.fn(() => ({
    date: "2026-08-28",
    boardState: "NO_TRADE",
    marketRegime: "UNKNOWN",
    scanTimestamp: null,
    lastMarketUpdate: null,
    lastNewsUpdate: null,
    lastAiUpdate: null,
    noHighConfidence: true,
    bestStock: null,
    bestCrypto: null,
    whyNoBestStock: null,
    whyNoBestCrypto: null,
    actionableTrades: [],
    candidates: [],
    topStocks: [],
    topCrypto: [],
    topEtfs: [],
    discovered: [],
    speculative: [],
    developing: [],
    blocked: [],
    watch: [],
    noTrade: [],
    dataSkipped: [],
    summary: { assetsEvaluated: 0, actionableTrades: 0 },
    newsSummary: {},
    freshnessSummary: {},
    whyNoSetup: [],
    blockerAggregate: null,
    confirmationSimulation: null,
    freshness: null,
    sectorExposureWarnings: [],
  })),
}));

import { getAuthUser } from "@/lib/auth/session";
import { GET } from "./route";

describe("GET /api/opportunities", () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/opportunities"));
    expect(response.status).toBe(401);
  });

  it("returns stored board payload when authenticated", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: "user-1", email: "a@b.c" } as never);
    const response = await GET(new Request("http://localhost/api/opportunities"));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { ok: boolean; candidates: unknown[] };
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.candidates)).toBe(true);
  });
});
