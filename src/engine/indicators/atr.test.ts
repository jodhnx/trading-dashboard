import { describe, expect, it } from "vitest";
import { atrLast, atrSeries, trueRange } from "./atr";
import type { OhlcvBar } from "../utils/validation";

function bar(high: number, low: number, close: number): Pick<OhlcvBar, "high" | "low" | "close"> {
  return { high, low, close };
}

describe("ATR", () => {
  it("uses the three-part true range formula", () => {
    expect(trueRange(12, 9, 9)).toBe(3);
    expect(trueRange(20, 18, 11)).toBe(9);
  });

  it("captures a gap in true range then Wilder-smooths", () => {
    const bars = [
      bar(10, 8, 9),
      bar(12, 9, 11),
      bar(20, 18, 19),
      bar(21, 18, 20),
    ];
    const series = atrSeries(bars, 2);
    expect(series[0]).toBeNull();
    expect(series[1]).toBeNull();
    expect(series[2]).toBeCloseTo((3 + 9) / 2, 12);
    expect(series[3]).toBeCloseTo((6 * 1 + 3) / 2, 12);
  });

  it("matches SMA-seeded Wilder ATR-14 on a flat range series", () => {
    const bars = Array.from({ length: 20 }, () => bar(12, 10, 11));
    const first = atrSeries(bars, 14)[14];
    expect(first).toBeCloseTo(2, 12);
    expect(atrLast(bars, 14)).toBeCloseTo(2, 12);
  });

  it("returns null when there are too few candles", () => {
    const bars = [bar(10, 9, 9.5), bar(11, 10, 10.5)];
    expect(atrLast(bars, 14)).toBeNull();
  });
});
