import { describe, expect, it } from "vitest";
import { candlesAtOrBefore, isValidOhlcv, prepareCandles } from "./validation";
import type { OhlcvBar } from "./validation";

function bar(day: number, close: number): OhlcvBar {
  return {
    timestamp: new Date(Date.UTC(2026, 0, day)),
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 100,
  };
}

describe("prepareCandles", () => {
  it("sorts, drops invalid bars, and keeps the last duplicate timestamp", () => {
    const invalid = { ...bar(2, 10), high: 1, low: 5 };
    const first = bar(3, 11);
    const dup = { ...bar(3, 12), volume: 200 };
    const out = prepareCandles([bar(5, 15), invalid, first, dup, bar(1, 9)]);
    expect(out.map((item) => item.close)).toEqual([9, 12, 15]);
  });
});

describe("candlesAtOrBefore", () => {
  it("excludes bars after T", () => {
    const out = candlesAtOrBefore(
      [bar(1, 1), bar(2, 2), bar(3, 3)],
      new Date(Date.UTC(2026, 0, 2)),
    );
    expect(out).toHaveLength(2);
    expect(out[1]?.close).toBe(2);
  });
});

describe("isValidOhlcv", () => {
  it("rejects a high below the low", () => {
    expect(isValidOhlcv({ ...bar(1, 10), high: 9, low: 11 })).toBe(false);
  });
});
