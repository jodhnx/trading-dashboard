import { describe, expect, it } from "vitest";
import { ResearchService } from "./research-service";
import { AI_SUMMARY_UNAVAILABLE } from "@/ai/schemas/news-summary";
import type { StoredNews } from "@/services/news/types";

function news(overrides: Partial<StoredNews> = {}): StoredNews {
  const publishedAt = new Date("2026-08-24T12:00:00.000Z");
  return {
    id: "news-1",
    title: "NVIDIA quarterly results fixture",
    summary: "Company results",
    sourceName: "Reuters",
    sourceUrl: "https://www.reuters.com/nvda",
    publishedAt,
    retrievedAt: new Date("2026-08-24T12:05:00.000Z"),
    assetSymbols: ["NVDA"],
    category: "EARNINGS",
    relevance: "HIGH",
    sentiment: "UNKNOWN",
    isMock: false,
    contentHash: "a".repeat(64),
    assetId: "asset-1",
    ...overrides,
  };
}

describe("ResearchService", () => {
  it("builds a NEW research item from news without inventing sentiment", () => {
    const item = new ResearchService(null).fromNews(news());
    expect(item.researchStatus).toBe("NEW");
    expect(item.headline).toBe("NVIDIA quarterly results fixture");
    expect(item.assetSymbol).toBe("NVDA");
    expect(item.sentiment).toBe("UNKNOWN");
    expect(item.informationType).toBe("FACT");
    expect(item.aiSummary).toBeNull();
  });

  it("stores a structured AI summary or AI_SUMMARY_UNAVAILABLE", () => {
    const service = new ResearchService(null);
    const unavailable = service.fromNews(news(), {
      status: AI_SUMMARY_UNAVAILABLE,
      summary: null,
    });
    expect(unavailable.aiSummary).toBe(AI_SUMMARY_UNAVAILABLE);
    expect(unavailable.informationType).toBe("FACT");

    const withAi = service.fromNews(news(), {
      status: "ok",
      summary: {
        summary: "NVIDIA reported results.",
        category: "EARNINGS",
        sentiment: "UNKNOWN",
        relevance: "HIGH",
        affectedAssets: ["NVDA"],
        keyPoints: ["Results were published"],
        uncertainties: ["Forward guidance not detailed"],
      },
    });
    expect(withAi.informationType).toBe("AI_INTERPRETATION");
    expect(withAi.aiSummary).toMatchObject({ category: "EARNINGS", affectedAssets: ["NVDA"] });
  });
});
