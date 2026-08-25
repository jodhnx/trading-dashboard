import { describe, expect, it } from "vitest";
import { analyzeVolume, classifyVolumeTrend } from "./volume";

describe("volume", () => {
  it("computes a 20-period average and ratio", () => {
    const volumes = Array.from({ length: 20 }, (_, i) => (i === 19 ? 200 : 100));
    const result = analyzeVolume(volumes);
    expect(result.averageVolume20).toBeCloseTo(105, 12);
    expect(result.currentVolume).toBe(200);
    expect(result.volumeRatio).toBeCloseTo(200 / 105, 12);
  });

  it("returns a null ratio when the average is zero", () => {
    const volumes = Array.from({ length: 20 }, () => 0);
    const result = analyzeVolume(volumes);
    expect(result.averageVolume20).toBe(0);
    expect(result.volumeRatio).toBeNull();
  });

  it("classifies INCREASING, DECREASING, NEUTRAL, and UNKNOWN", () => {
    expect(classifyVolumeTrend([1, 1, 1, 1, 1, 2, 2, 2, 2, 2])).toBe("INCREASING");
    expect(classifyVolumeTrend([2, 2, 2, 2, 2, 1, 1, 1, 1, 1])).toBe("DECREASING");
    expect(classifyVolumeTrend([10, 10, 10, 10, 10, 10.2, 10.2, 10.2, 10.2, 10.2])).toBe(
      "NEUTRAL",
    );
    expect(classifyVolumeTrend([1, 2, 3])).toBe("UNKNOWN");
  });

  it("does not invent an average from fewer than 20 volumes", () => {
    const result = analyzeVolume(Array.from({ length: 19 }, () => 50));
    expect(result.averageVolume20).toBeNull();
    expect(result.volumeRatio).toBeNull();
    expect(result.currentVolume).toBe(50);
  });
});
