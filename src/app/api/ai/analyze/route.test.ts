import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { analysisOutput, longSetup } from "@/ai/test-fixtures";
import type { TradingAnalysisRecord } from "@/ai/types";

const getAuthUser = vi.fn();
const runTradingAnalysis = vi.fn();
const listOwnAnalyses = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: () => getAuthUser(),
}));

vi.mock("@/services/ai/analyze-service", () => ({
  runTradingAnalysis: (...args: unknown[]) => runTradingAnalysis(...args),
}));

vi.mock("@/services/ai/persistence", () => ({
  listOwnAnalyses: (...args: unknown[]) => listOwnAnalyses(...args),
}));

import { GET, POST } from "./route";

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/ai/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getRequest(query: string) {
  return new NextRequest(`http://localhost/api/ai/analyze${query}`);
}

describe("POST /api/ai/analyze", () => {
  beforeEach(() => {
    getAuthUser.mockReset();
    runTradingAnalysis.mockReset();
    listOwnAnalyses.mockReset();
  });

  it("returns 401 without a session", async () => {
    getAuthUser.mockResolvedValue(null);
    const response = await POST(postRequest({ symbol: "NVDA", timeframe: "1day" }));
    expect(response.status).toBe(401);
    expect(runTradingAnalysis).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid symbol", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: "a@b.c" });
    const response = await POST(
      postRequest({ symbol: "bad symbol", timeframe: "1day" }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid timeframe", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: "a@b.c" });
    const response = await POST(postRequest({ symbol: "NVDA", timeframe: "3day" }));
    expect(response.status).toBe(400);
  });

  it("returns 503 when market data is unavailable", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: "a@b.c" });
    runTradingAnalysis.mockResolvedValue({
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "MARKET DATA UNAVAILABLE",
    });
    const response = await POST(postRequest({ symbol: "NVDA", timeframe: "1day" }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "DATA_UNAVAILABLE" });
  });

  it("returns 502 when the analysis is invalid", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: "a@b.c" });
    runTradingAnalysis.mockResolvedValue({
      ok: false,
      code: "AI_ANALYSIS_INVALID",
      error: "setupReference must copy the engine values",
    });
    const response = await POST(postRequest({ symbol: "NVDA", timeframe: "1day" }));
    expect(response.status).toBe(502);
  });

  it("returns 200 with an analysis and no secrets", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: "a@b.c" });
    const setup = longSetup();
    const analysis: TradingAnalysisRecord = {
      id: "a1",
      symbol: "NVDA",
      timeframe: "1day",
      ...analysisOutput(setup),
      model: "gpt-4o-mini",
      isMock: false,
      analyzedAt: "2026-08-24T18:00:00.000Z",
      dataTimestamp: "2026-08-24T18:00:00.000Z",
      dataStatus: "LIVE",
      newsCount: 1,
      news: [],
      promptVersion: "trading-analysis-v1",
    };
    runTradingAnalysis.mockResolvedValue({ ok: true, analysis });
    const response = await POST(postRequest({ symbol: "nvda", timeframe: "1day" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.analysis.decision).toBe("BUY_SETUP");
    expect(JSON.stringify(body)).not.toMatch(/OPENAI_API_KEY|sk-|SUPABASE_SECRET/);
    expect(runTradingAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", symbol: "NVDA", timeframe: "1day" }),
    );
  });
});

describe("GET /api/ai/analyze", () => {
  beforeEach(() => {
    getAuthUser.mockReset();
    listOwnAnalyses.mockReset();
  });

  it("returns 401 without a session", async () => {
    getAuthUser.mockResolvedValue(null);
    const response = await GET(getRequest("?symbol=NVDA"));
    expect(response.status).toBe(401);
    expect(listOwnAnalyses).not.toHaveBeenCalled();
  });

  it("returns only the authenticated user's analyses", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: "a@b.c" });
    listOwnAnalyses.mockResolvedValue([]);
    const response = await GET(getRequest("?symbol=NVDA&limit=10"));
    expect(response.status).toBe(200);
    expect(listOwnAnalyses).toHaveBeenCalledWith({
      userId: "user-1",
      symbol: "NVDA",
      limit: 10,
    });
    expect(listOwnAnalyses).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-2" }),
    );
  });
});

describe("AI analyze UI source", () => {
  it("does not call OpenAI or the analyze API on page load", () => {
    const page = readFileSync(
      path.join(process.cwd(), "src/app/(app)/market/[symbol]/page.tsx"),
      "utf8",
    );
    const panel = readFileSync(
      path.join(process.cwd(), "src/components/market/ai-analysis-panel.tsx"),
      "utf8",
    );
    expect(page).not.toMatch(/runTradingAnalysis|analyzeTradingSetup|createOpenAiClient|openai\.com/);
    expect(page).not.toMatch(/OPENAI_API_KEY/);
    expect(page).toMatch(/AiAnalysisPanel/);
    expect(panel).not.toMatch(/useEffect/);
    expect(panel).toMatch(/Analyze Setup/);
    expect(panel).toMatch(/Analyzing/);
    expect(panel).toMatch(/not an executed order/);
    expect(panel).toMatch(/body\?\.error/);
    expect(panel).toMatch(/method: "POST"/);
    expect(panel).not.toMatch(/OPENAI_API_KEY/);
  });

  it("never silently constructs a mock client in production factory source", () => {
    const factory = readFileSync(
      path.join(process.cwd(), "src/ai/create-client.ts"),
      "utf8",
    );
    expect(factory).toMatch(/HttpOpenAiClient/);
    expect(factory).not.toMatch(/MockOpenAiClient/);
    expect(factory).toMatch(/server-only/);
  });
});
