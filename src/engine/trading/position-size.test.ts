import { describe, expect, it } from "vitest";
import { allowedRiskAmount, RISK_EPSILON, sizePosition } from "./position-size";
import { isWithinRiskLimit } from "./validation";

describe("position size", () => {
  it("matches the 10000 / 1% / entry 100 / stop 95 reference", () => {
    const result = sizePosition({
      accountCapital: 10_000,
      maxRiskPercent: 0.01,
      maxPositionPercent: 1,
      entry: 100,
      riskPerUnit: 5,
    });
    expect(allowedRiskAmount(10_000, 0.01)).toBe(100);
    expect(result.riskAmount).toBeCloseTo(100, 10);
    expect(result.positionSize).toBeCloseTo(20, 10);
    expect(result.positionValue).toBeCloseTo(2000, 10);
    expect(result.actualRisk).toBeCloseTo(100, 10);
    expect(result.rejectReason).toBeNull();
  });

  it("caps size by max position percent", () => {
    const result = sizePosition({
      accountCapital: 10_000,
      maxRiskPercent: 0.01,
      maxPositionPercent: 0.1,
      entry: 100,
      riskPerUnit: 5,
    });
    expect(result.maxPositionSize).toBeCloseTo(10, 10);
    expect(result.positionSize).toBeCloseTo(10, 10);
    expect(result.positionValue).toBeCloseTo(1000, 10);
    expect(result.actualRisk).toBeCloseTo(50, 10);
    expect(result.actualRisk).toBeLessThanOrEqual(100 + RISK_EPSILON);
    expect(result.cappedBy).toBe("POSITION");
  });

  it("never lets actualRisk exceed allowed risk (property)", () => {
    const capitals = [1_000, 10_000, 50_000];
    const riskPercents = [0.005, 0.01, 0.02];
    const entries = [10, 100, 500];
    const stopGaps = [0.5, 2, 8];
    const maxPositions = [0.1, 0.25, 1];
    for (const capital of capitals) {
      for (const riskPercent of riskPercents) {
        for (const entry of entries) {
          for (const gap of stopGaps) {
            for (const maxPosition of maxPositions) {
              const result = sizePosition({
                accountCapital: capital,
                maxRiskPercent: riskPercent,
                maxPositionPercent: maxPosition,
                entry,
                riskPerUnit: gap,
              });
              const allowed = capital * riskPercent;
              expect(result.rejectReason).toBeNull();
              expect(
                isWithinRiskLimit(result.actualRisk, allowed, RISK_EPSILON),
              ).toBe(true);
            }
          }
        }
      }
    }
  });

  it("rejects a zero position size", () => {
    const result = sizePosition({
      accountCapital: 10_000,
      maxRiskPercent: 0.01,
      maxPositionPercent: 0.2,
      entry: 100,
      riskPerUnit: Number.POSITIVE_INFINITY,
    });
    expect(result.rejectReason).toBe("POSITION_SIZE_ZERO");
  });

  it("flags invalid risk settings", () => {
    expect(
      sizePosition({
        accountCapital: 0,
        maxRiskPercent: 0.01,
        maxPositionPercent: 0.2,
        entry: 100,
        riskPerUnit: 5,
      }).rejectReason,
    ).toBe("INVALID_RISK");
  });

  it("flags non-positive risk per unit", () => {
    expect(
      sizePosition({
        accountCapital: 10_000,
        maxRiskPercent: 0.01,
        maxPositionPercent: 0.2,
        entry: 100,
        riskPerUnit: 0,
      }).rejectReason,
    ).toBe("INVALID_RR");
  });
});
