import { describe, expect, it } from "vitest";
import { clusterLevels, supportResistance, swingIndices } from "./support-resistance";
import type { OhlcvBar } from "../utils/validation";

function bar(day: number, low: number, high: number, close: number): OhlcvBar {
  return {
    timestamp: new Date(Date.UTC(2026, 0, day)),
    open: close,
    high,
    low,
    close,
    volume: 1_000,
  };
}

describe("support and resistance", () => {
  it("finds a known swing high and swing low", () => {
    const highs = [1, 2, 5, 2, 1, 2, 3];
    const lows = [3, 2, 1, 2, 3, 2, 1];
    expect(swingIndices(highs, 2, "high")).toEqual([2]);
    expect(swingIndices(lows, 2, "low")).toEqual([2]);
  });

  it("counts clustered touches and uses touches as strength", () => {
    const levels = clusterLevels([10, 10.02, 12], 0.005);
    expect(levels).toHaveLength(2);
    expect(levels[0]?.touches).toBe(2);
    expect(levels[0]?.strength).toBe(2);
    expect(levels[0]?.price).toBeCloseTo(10.01, 10);
  });

  it("returns empty arrays without enough candles", () => {
    const bars = Array.from({ length: 10 }, (_, i) => bar(i + 1, 9, 11, 10));
    expect(supportResistance(bars, 10)).toEqual({
      supportLevels: [],
      resistanceLevels: [],
    });
  });

  it("emits support below price and resistance above from constructed swings", () => {
    const bars: OhlcvBar[] = [];
    const profile = [
      10, 11, 12, 11, 10, 9, 10, 11, 12, 13, 14, 13, 12, 13, 14, 15, 16, 15, 14, 15, 16,
      17,
    ];
    for (let i = 0; i < profile.length; i += 1) {
      const close = profile[i]!;
      bars.push(bar(i + 1, close - 1, close + 1, close));
    }
    const { supportLevels, resistanceLevels } = supportResistance(bars, 15);
    expect(supportLevels.every((level) => level.price < 15)).toBe(true);
    expect(resistanceLevels.every((level) => level.price > 15)).toBe(true);
    expect(supportLevels.length + resistanceLevels.length).toBeGreaterThan(0);
    for (const level of [...supportLevels, ...resistanceLevels]) {
      expect(level.strength).toBe(level.touches);
      expect(level.touches).toBeGreaterThanOrEqual(1);
    }
  });
});
