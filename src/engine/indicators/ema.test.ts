import { describe, expect, it } from "vitest";
import { emaLast, emaMultiplier, emaSeries } from "./ema";

describe("EMA", () => {
  it("matches a hand-calculated period-3 series", () => {
    const k = emaMultiplier(3);
    expect(k).toBeCloseTo(0.5, 12);
    const series = emaSeries([1, 2, 3, 4, 5], 3);
    expect(series[0]).toBeNull();
    expect(series[1]).toBeNull();
    expect(series[2]).toBeCloseTo((1 + 2 + 3) / 3, 12);
    expect(series[3]).toBeCloseTo(4 * k + 2 * (1 - k), 12);
    expect(series[4]).toBeCloseTo(5 * k + 3 * (1 - k), 12);
  });

  it("stays on a constant series after the SMA seed", () => {
    const series = emaSeries([10, 10, 10, 10, 10], 3);
    expect(series[2]).toBeCloseTo(10, 12);
    expect(series[4]).toBeCloseTo(10, 12);
  });

  it("rises with a strictly increasing series", () => {
    const series = emaSeries([1, 2, 3, 4, 5, 6, 7, 8], 4);
    expect(series[3]).toBeCloseTo(2.5, 12);
    expect(series[7]).toBeGreaterThan(series[3]!);
    expect(series[7]).toBeLessThan(8);
  });

  it("returns null when there are too few values", () => {
    expect(emaLast([1, 2, 3], 4)).toBeNull();
    expect(emaSeries([1, 2, 3], 4)).toEqual([null, null, null]);
  });

  it("matches the expanded SMA-seed formula on a known 10-period sample", () => {
    const closes = [
      22.27, 22.19, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43, 22.24, 22.29, 22.15,
      22.39, 22.38, 22.61, 23.36,
    ];
    const seed =
      (22.27 + 22.19 + 22.08 + 22.17 + 22.18 + 22.13 + 22.23 + 22.43 + 22.24 + 22.29) /
      10;
    const k = 2 / 11;
    const day11 = 22.15 * k + seed * (1 - k);
    const day12 = 22.39 * k + day11 * (1 - k);
    const series = emaSeries(closes, 10);
    expect(series[9]).toBeCloseTo(seed, 10);
    expect(series[10]).toBeCloseTo(day11, 10);
    expect(series[11]).toBeCloseTo(day12, 10);
    expect(emaLast(closes, 10)).toBeCloseTo(series[series.length - 1]!, 12);
  });
});
