import { describe, expect, it } from "vitest";
import { analysisFromRow, toInputSnapshot, toInsertRow } from "./map-row";
import {
  analysisInput,
  analysisOutput,
  longSetup,
} from "@/ai/test-fixtures";
import type { TradingAnalysisRecord } from "@/ai/types";
import type { AiAnalysisRow } from "@/types/database";

describe("AI analysis row mapping", () => {
  const setup = longSetup();
  const payload = analysisInput({ setup });
  const output = analysisOutput(setup);
  const record: TradingAnalysisRecord = {
    id: null,
    symbol: "NVDA",
    timeframe: "1day",
    ...output,
    model: "gpt-4o-mini",
    isMock: false,
    analyzedAt: "2026-08-24T18:00:00.000Z",
    dataTimestamp: payload.marketData.asOf,
    dataStatus: payload.marketData.dataStatus,
    newsCount: payload.relevantNews.length,
    news: payload.relevantNews,
    promptVersion: "trading-analysis-v1",
  };

  it("stores an input snapshot without secrets", () => {
    const snapshot = toInputSnapshot(payload, record);
    const json = JSON.stringify(snapshot);
    expect(json).toMatch(/NVIDIA quarterly results/);
    expect(json).toMatch(/technicalSnapshot/);
    expect(json).toMatch(/tradingSetup/);
    expect(json).not.toMatch(/OPENAI_API_KEY|sk-/);
    expect(json).not.toMatch(/SUPABASE_SECRET_KEY/);
  });

  it("round-trips a persisted row", () => {
    const inserted = toInsertRow({
      userId: "user-1",
      assetId: "asset-1",
      record,
      payload,
      setupScore: setup.score,
    });
    expect(inserted.user_id).toBe("user-1");
    expect(inserted.decision).toBe("BUY_SETUP");
    expect(inserted.is_mock).toBe(false);
    const row = {
      id: "row-1",
      created_at: record.analyzedAt,
      invalidation: null,
      market_regime: null,
      ...inserted,
    } as unknown as AiAnalysisRow;
    const restored = analysisFromRow(row, "NVDA");
    expect(restored?.decision).toBe("BUY_SETUP");
    expect(restored?.news[0]?.sourceUrl).toBe("https://www.reuters.com/nvda");
    expect(restored?.setupReference.entry).toBe(setup.entry);
  });
});
