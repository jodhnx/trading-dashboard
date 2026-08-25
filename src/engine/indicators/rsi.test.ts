import { describe, expect, it } from "vitest";
import { rsiFromAverages, rsiLast, rsiSeries } from "./rsi";

describe("RSI", () => {
  it("is 50 on a constant series once enough bars exist", () => {
    const closes = Array.from({ length: 20 }, () => 40);
    expect(rsiLast(closes, 14)).toBeCloseTo(50, 12);
  });

  it("is 100 on a strictly rising series", () => {
    const closes = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(rsiLast(closes, 14)).toBeCloseTo(100, 12);
  });

  it("is 0 on a strictly falling series", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 20 - i);
    expect(rsiLast(closes, 14)).toBeCloseTo(0, 12);
  });

  it("matches a hand-calculated Wilder period-2 path", () => {
    const series = rsiSeries([10, 11, 12, 11], 2);
    expect(series[0]).toBeNull();
    expect(series[1]).toBeNull();
    expect(series[2]).toBeCloseTo(100, 12);
    expect(series[3]).toBeCloseTo(50, 12);
  });

  it("matches the first Wilder RSI-14 from a known price sample", () => {
    const closes = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89,
      46.03, 45.61, 46.28, 46.28,
    ];
    const changes = closes.slice(1).map((close, i) => close - closes[i]!);
    const gains = changes.map((change) => (change > 0 ? change : 0));
    const losses = changes.map((change) => (change < 0 ? -change : 0));
    const avgGain = gains.slice(0, 14).reduce((sum, value) => sum + value, 0) / 14;
    const avgLoss = losses.slice(0, 14).reduce((sum, value) => sum + value, 0) / 14;
    expect(rsiLast(closes, 14)).toBeCloseTo(rsiFromAverages(avgGain, avgLoss), 10);
    expect(rsiLast(closes, 14)).toBeCloseTo(70.46413502109705, 8);
  });

  it("returns null when there are too few closes", () => {
    expect(rsiLast([1, 2, 3, 4], 14)).toBeNull();
    expect(rsiSeries([1, 2, 3], 14)).toEqual([null, null, null]);
  });
});
