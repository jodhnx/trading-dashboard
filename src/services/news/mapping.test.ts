import { describe, expect, it } from "vitest";
import { mapNewsAssets } from "./mapping";
import { classifyCategory, classifyRelevance } from "./classify";

describe("asset mapping", () => {
  it("maps NVIDIA to NVDA and Bitcoin to BTC", () => {
    expect(mapNewsAssets("NVIDIA reported data-center demand")).toEqual({
      symbols: ["NVDA"],
      uniqueSymbol: "NVDA",
    });
    expect(mapNewsAssets("Bitcoin climbed after ETF inflows")).toEqual({
      symbols: ["BTC"],
      uniqueSymbol: "BTC",
    });
  });

  it("does not guess when mapping is not unique or not evidenced", () => {
    expect(mapNewsAssets("NVIDIA and Bitcoin both moved")).toEqual({
      symbols: [],
      uniqueSymbol: null,
    });
    expect(mapNewsAssets("A semiconductor supplier commented")).toEqual({
      symbols: [],
      uniqueSymbol: null,
    });
  });

  it("leaves Fed / FOMC news unmapped", () => {
    expect(mapNewsAssets("FOMC interest rate decision from the Federal Reserve")).toEqual({
      symbols: [],
      uniqueSymbol: null,
    });
  });
});

describe("category and relevance", () => {
  it("classifies earnings, rates, and crypto from evidence", () => {
    expect(classifyCategory("NVIDIA quarterly results beat estimates")).toBe("EARNINGS");
    expect(classifyCategory("FOMC interest rate decision")).toBe("RATES");
    expect(classifyCategory("Bitcoin network activity rose")).toBe("CRYPTO");
    expect(classifyCategory("Unrelated local weather report")).toBe("OTHER");
  });

  it("uses documented relevance rules", () => {
    expect(classifyRelevance("NVIDIA quarterly results")).toBe("HIGH");
    expect(classifyRelevance("Trading halt in semiconductor shares")).toBe("CRITICAL");
    expect(classifyRelevance("Bitcoin climbed after ETF inflows")).toBe("MEDIUM");
    expect(classifyRelevance("Local weather report")).toBe("LOW");
  });
});
