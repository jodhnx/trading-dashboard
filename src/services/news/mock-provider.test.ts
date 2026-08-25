import { describe, expect, it } from "vitest";
import { MockNewsProvider } from "./mock-provider";

describe("MockNewsProvider", () => {
  const now = () => new Date("2026-08-24T16:00:00.000Z");
  const provider = new MockNewsProvider(now);

  it("is clearly marked as mock", async () => {
    expect(provider.isMock).toBe(true);
    expect(provider.id).toBe("mock");
    const items = await provider.getLatestNews();
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.isMock)).toBe(true);
    expect(items.every((item) => item.title.startsWith("[MOCK]"))).toBe(true);
    expect(items.every((item) => item.sourceName === "MOCK")).toBe(true);
    expect(items.every((item) => item.sourceUrl.startsWith("https://mock.news.local/"))).toBe(
      true,
    );
    expect(items.every((item) => item.sentiment === "UNKNOWN")).toBe(true);
  });

  it("is deterministic for a fixed clock", async () => {
    const first = await provider.getLatestNews();
    const second = await new MockNewsProvider(now).getLatestNews();
    expect(first.map((item) => item.contentHash)).toEqual(
      second.map((item) => item.contentHash),
    );
    expect(first[0]?.publishedAt.toISOString()).toBe("2026-08-24T14:00:00.000Z");
  });

  it("maps NVDA and BTC fixtures uniquely", async () => {
    const nvda = await provider.getAssetNews("NVDA");
    const btc = await provider.getAssetNews("btc");
    expect(nvda).toHaveLength(1);
    expect(nvda[0]?.assetSymbols).toEqual(["NVDA"]);
    expect(btc).toHaveLength(1);
    expect(btc[0]?.assetSymbols).toEqual(["BTC"]);
  });

  it("keeps Fed fixtures unmapped", async () => {
    const market = await provider.getMarketNews();
    expect(market.some((item) => /FOMC/i.test(item.title))).toBe(true);
    expect(market.every((item) => item.assetSymbols.length === 0)).toBe(true);
  });
});
