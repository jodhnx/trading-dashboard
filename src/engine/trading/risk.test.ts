import { describe, expect, it } from "vitest";
import { computeRiskReward, computeStopLoss, computeTakeProfit } from "./risk";

describe("risk levels", () => {
  it("uses ATR × multiplier for a LONG stop", () => {
    const result = computeStopLoss({
      direction: "LONG",
      entry: 100,
      atr: 5,
      supportLevels: [],
      resistanceLevels: [],
      atrMultiplier: 1,
    });
    expect(result.invalid).toBeNull();
    expect(result.stopLoss).toBeCloseTo(95, 10);
  });

  it("uses ATR × multiplier for a SHORT stop", () => {
    const result = computeStopLoss({
      direction: "SHORT",
      entry: 100,
      atr: 5,
      supportLevels: [],
      resistanceLevels: [],
      atrMultiplier: 1,
    });
    expect(result.invalid).toBeNull();
    expect(result.stopLoss).toBeCloseTo(105, 10);
  });

  it("rejects a stop that is tighter than the minimum ATR distance", () => {
    const result = computeStopLoss({
      direction: "LONG",
      entry: 100,
      atr: 5,
      supportLevels: [],
      resistanceLevels: [],
      atrMultiplier: 0.1,
    });
    expect(result.invalid).toBe("INVALID_STOP");
  });

  it("builds a 2:1 take profit from the stop", () => {
    const result = computeTakeProfit({
      direction: "LONG",
      entry: 100,
      stopLoss: 95,
      minimumRiskReward: 2,
      supportLevels: [],
      resistanceLevels: [],
    });
    expect(result.invalid).toBeNull();
    expect(result.takeProfit).toBeCloseTo(110, 10);
    expect(result.riskReward).toBeCloseTo(2, 10);
  });

  it("builds a 3:1 take profit", () => {
    const result = computeTakeProfit({
      direction: "LONG",
      entry: 100,
      stopLoss: 95,
      minimumRiskReward: 3,
      supportLevels: [],
      resistanceLevels: [],
    });
    expect(result.takeProfit).toBeCloseTo(115, 10);
    expect(result.riskReward).toBeCloseTo(3, 10);
  });

  it("rejects when R:R would fall below the minimum", () => {
    const rr = computeRiskReward({
      direction: "LONG",
      entry: 100,
      stopLoss: 95,
      takeProfit: 102,
      minimumRiskReward: 2,
    });
    expect(rr.invalid).toBe("INVALID_RR");
    expect(rr.riskReward).toBeCloseTo(0.4, 10);
  });

  it("rejects a non-positive risk per unit", () => {
    const rr = computeRiskReward({
      direction: "LONG",
      entry: 100,
      stopLoss: 100,
      takeProfit: 110,
      minimumRiskReward: 2,
    });
    expect(rr.invalid).toBe("INVALID_RR");
  });

  it("rejects an invalid target at or below zero", () => {
    const result = computeTakeProfit({
      direction: "SHORT",
      entry: 1,
      stopLoss: 1.5,
      minimumRiskReward: 3,
      supportLevels: [],
      resistanceLevels: [],
    });
    expect(result.takeProfit).toBeLessThanOrEqual(0);
    expect(result.invalid).toBe("INVALID_TARGET");
  });

  it("caps LONG take profit at resistance when planned R:R is above the minimum", () => {
    const result = computeTakeProfit({
      direction: "LONG",
      entry: 100,
      stopLoss: 95,
      minimumRiskReward: 2,
      plannedRiskReward: 3,
      supportLevels: [],
      resistanceLevels: [{ price: 111, strength: 3, touches: 3 }],
    });
    expect(result.invalid).toBeNull();
    expect(result.takeProfit).toBeCloseTo(111, 10);
    expect(result.riskReward).toBeGreaterThanOrEqual(2);
  });

  it("rejects when resistance blocks the minimum R:R", () => {
    const result = computeTakeProfit({
      direction: "LONG",
      entry: 100,
      stopLoss: 95,
      minimumRiskReward: 2,
      supportLevels: [],
      resistanceLevels: [{ price: 102, strength: 3, touches: 3 }],
    });
    expect(result.invalid).toBe("INVALID_RR");
  });
});
