import { describe, expect, it } from "vitest";
import { quoteCache, candleCache } from "@/services/market/cache";
import { invalidateMarketSymbolCache } from "./cache-invalidation";

describe("invalidateMarketSymbolCache", () => {
  it("removes only the targeted symbol keys", () => {
    quoteCache.set("quote:NVDA", { price: 1 } as never, 30_000);
    quoteCache.set("quote:SPY", { price: 2 } as never, 30_000);
    candleCache.set("candles:NVDA:1day:200", [] as never, 60_000);
    candleCache.set("candles:SPY:1day:200", [] as never, 60_000);

    invalidateMarketSymbolCache("NVDA", "1day");

    expect(quoteCache.get("quote:NVDA")).toBeUndefined();
    expect(quoteCache.get("quote:SPY")).toBeDefined();
    expect(candleCache.get("candles:NVDA:1day:200")).toBeUndefined();
    expect(candleCache.get("candles:SPY:1day:200")).toBeDefined();
  });
});
