import { describe, expect, it, vi } from "vitest";
import { NewsApiProvider } from "./newsapi-provider";
import { NewsUnavailableError } from "./errors";

function article(overrides: Record<string, unknown> = {}) {
  return {
    source: { name: "Reuters" },
    title: "NVIDIA quarterly results beat estimates",
    description: "NVIDIA reported quarterly results.",
    url: "https://www.reuters.com/nvda-1",
    publishedAt: "2026-08-24T12:00:00Z",
    ...overrides,
  };
}

describe("NewsApiProvider", () => {
  it("normalizes NewsAPI articles and drops invalid ones", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "ok",
        articles: [
          article(),
          article({ title: "", url: "https://www.reuters.com/bad" }),
          article({
            title: "Bitcoin climbed",
            description: "Bitcoin network note",
            url: "https://www.reuters.com/btc-1",
          }),
        ],
      }),
    });
    const provider = new NewsApiProvider("test-key", fetchFn as unknown as typeof fetch);
    const items = await provider.getLatestNews();
    expect(items).toHaveLength(2);
    expect(items[0]?.sourceName).toBe("Reuters");
    expect(items[0]?.sourceUrl).toBe("https://www.reuters.com/nvda-1");
    expect(items[0]?.isMock).toBe(false);
    expect(items[0]?.sentiment).toBe("UNKNOWN");
    expect(items[0]?.assetSymbols).toEqual(["NVDA"]);
    expect(items[1]?.assetSymbols).toEqual(["BTC"]);
    expect(JSON.stringify(items)).not.toContain("test-key");
    const calledUrl = String(fetchFn.mock.calls[0]?.[0]);
    expect(calledUrl).not.toContain("test-key");
    expect(fetchFn.mock.calls[0]?.[1]?.headers?.["X-Api-Key"]).toBe("test-key");
  });

  it("returns no asset news when the symbol has no verified query", async () => {
    const fetchFn = vi.fn();
    const provider = new NewsApiProvider("test-key", fetchFn as unknown as typeof fetch);
    await expect(provider.getAssetNews("UNKNOWNXYZ")).resolves.toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("throws NEWS UNAVAILABLE on provider failure without leaking the key", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ status: "error", code: "apiKeyInvalid", message: "bad" }),
    });
    const provider = new NewsApiProvider("super-secret", fetchFn as unknown as typeof fetch);
    await expect(provider.getMarketNews()).rejects.toBeInstanceOf(NewsUnavailableError);
  });
});
