import { describe, expect, it } from "vitest";
import { lastFinite, mean, wilderSmooth } from "./math";

describe("mean", () => {
  it("returns the arithmetic mean", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });

  it("returns null for an empty list", () => {
    expect(mean([])).toBeNull();
  });
});

describe("wilderSmooth", () => {
  it("seeds with SMA then applies Wilder smoothing", () => {
    const series = wilderSmooth([1, 3, 5, 7], 2);
    expect(series[0]).toBeNull();
    expect(series[1]).toBeCloseTo(2, 12);
    expect(series[2]).toBeCloseTo((2 * 1 + 5) / 2, 12);
    expect(series[3]).toBeCloseTo((((2 * 1 + 5) / 2) * 1 + 7) / 2, 12);
  });

  it("returns nulls when there are too few values", () => {
    expect(wilderSmooth([1, 2], 3).every((value) => value === null)).toBe(true);
  });
});

describe("lastFinite", () => {
  it("returns the last finite number", () => {
    expect(lastFinite([null, 1, null, 4])).toBe(4);
    expect(lastFinite([null, null])).toBeNull();
  });
});
