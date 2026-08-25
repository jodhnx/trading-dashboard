import { describe, expect, it, vi } from "vitest";
import { summarizeNews } from "./summarize";
import { AI_SUMMARY_UNAVAILABLE } from "@/ai/schemas/news-summary";

const item = {
  title: "NVIDIA quarterly results",
  summary: "NVIDIA reported results.",
  sourceName: "Reuters",
  publishedAt: new Date("2026-08-24T12:00:00.000Z"),
  assetSymbols: ["NVDA"],
  category: "EARNINGS" as const,
  relevance: "HIGH" as const,
};

describe("summarizeNews", () => {
  it("returns AI_SUMMARY_UNAVAILABLE without a key and does not call OpenAI", async () => {
    const fetchFn = vi.fn();
    const result = await summarizeNews(item, { apiKey: null, fetchFn: fetchFn as unknown as typeof fetch });
    expect(result).toEqual({ status: AI_SUMMARY_UNAVAILABLE, summary: null });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("validates structured output and rejects trading language", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "NVIDIA reported results.",
                category: "EARNINGS",
                sentiment: "UNKNOWN",
                relevance: "HIGH",
                affectedAssets: ["NVDA", "AAPL"],
                keyPoints: ["Results published"],
                uncertainties: [],
              }),
            },
          },
        ],
      }),
    });
    const result = await summarizeNews(item, {
      apiKey: "sk-test",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.summary.affectedAssets).toEqual(["NVDA"]);
    }

    const trading = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Investors should buy NVDA",
                category: "EARNINGS",
                sentiment: "POSITIVE",
                relevance: "HIGH",
                affectedAssets: ["NVDA"],
                keyPoints: [],
                uncertainties: [],
              }),
            },
          },
        ],
      }),
    });
    await expect(
      summarizeNews(item, { apiKey: "sk-test", fetchFn: trading as unknown as typeof fetch }),
    ).resolves.toEqual({ status: AI_SUMMARY_UNAVAILABLE, summary: null });
  });
});
