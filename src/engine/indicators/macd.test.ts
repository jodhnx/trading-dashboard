import { describe, expect, it } from "vitest";
import { macdLast, macdSeries } from "./macd";
import { emaLast } from "./ema";

describe("MACD", () => {
  it("is zero on a long constant series", () => {
    const closes = Array.from({ length: 50 }, () => 100);
    const point = macdLast(closes);
    expect(point.macd).toBeCloseTo(0, 12);
    expect(point.signal).toBeCloseTo(0, 12);
    expect(point.histogram).toBeCloseTo(0, 12);
  });

  it("matches EMA12 − EMA26 and histogram = macd − signal", () => {
    const closes = Array.from({ length: 40 }, (_, i) => 50 + i);
    const point = macdLast(closes);
    const expectedMacd = emaLast(closes, 12)! - emaLast(closes, 26)!;
    expect(point.macd).toBeCloseTo(expectedMacd, 12);
    expect(point.histogram).toBeCloseTo(point.macd! - point.signal!, 12);
  });

  it("matches a hand-calculated 2/3/2 MACD", () => {
    const closes = [1, 2, 3, 4, 5, 6];
    const series = macdSeries(closes, 2, 3, 2);
    expect(series[0]?.macd).toBeNull();
    expect(series[1]?.macd).toBeNull();
    expect(series[2]?.macd).toBeCloseTo(0.5, 12);
    expect(series[5]?.macd).toBeCloseTo(0.5, 12);
    expect(series[2]?.signal).toBeNull();
    expect(series[3]?.signal).toBeCloseTo(0.5, 12);
    expect(series[5]?.histogram).toBeCloseTo(0, 12);
  });

  it("returns nulls when there are too few closes", () => {
    const point = macdLast([1, 2, 3, 4, 5], 12, 26, 9);
    expect(point.macd).toBeNull();
    expect(point.signal).toBeNull();
    expect(point.histogram).toBeNull();
  });
});
