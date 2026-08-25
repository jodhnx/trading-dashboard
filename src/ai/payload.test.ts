import { describe, expect, it } from "vitest";
import { buildTradingAnalysisInput, MAX_ANALYSIS_NEWS } from "./payload";
import { liveSnapshot, longSetup, SAMPLE_NEWS, TEST_SETTINGS } from "./test-fixtures";

describe("buildTradingAnalysisInput", () => {
  it("caps news at 10 and omits candle arrays", () => {
    const news = Array.from({ length: 15 }, (_, index) => ({
      id: `news-${index}`,
      title: `Headline ${index}`,
      summary: "Summary",
      sourceName: "Reuters",
      sourceUrl: `https://www.reuters.com/${index}`,
      publishedAt: new Date("2026-08-24T12:00:00.000Z"),
      category: SAMPLE_NEWS.category,
      relevance: SAMPLE_NEWS.relevance,
      sentiment: SAMPLE_NEWS.sentiment,
    }));
    const payload = buildTradingAnalysisInput({
      symbol: "NVDA",
      timeframe: "1day",
      snapshot: liveSnapshot(),
      setup: longSetup(),
      news,
      settings: TEST_SETTINGS,
      now: new Date("2026-08-24T18:00:00.000Z"),
    });
    expect(payload.relevantNews).toHaveLength(MAX_ANALYSIS_NEWS);
    expect(JSON.stringify(payload)).not.toMatch(/candles/);
    expect(payload.marketData.currentPrice).toBe(100);
    expect(payload.technicalSnapshot.rsi14).toBe(60);
    expect(payload.tradingSetup.entry).toBe(longSetup().entry);
  });
});
