import { describe, expect, it } from "vitest";
import { buildPaperEquityCurve, computeMaxDrawdownFromCurve } from "./drawdown";

describe("analytics drawdown", () => {
  it("builds realized equity curve chronologically", () => {
    const curve = buildPaperEquityCurve({
      startingBalance: 10000,
      closedTrades: [
        { closedAt: "2026-01-03T00:00:00.000Z", pnl: 50 },
        { closedAt: "2026-01-01T00:00:00.000Z", pnl: 100 },
        { closedAt: "2026-01-02T00:00:00.000Z", pnl: -30 },
      ],
    });
    expect(curve).toHaveLength(3);
    expect(curve[0]?.equity).toBe(10100);
    expect(curve[1]?.equity).toBe(10070);
    expect(curve[2]?.equity).toBe(10120);
  });

  it("computes max drawdown from equity curve", () => {
    const curve = buildPaperEquityCurve({
      startingBalance: 10000,
      closedTrades: [
        { closedAt: "2026-01-01T00:00:00.000Z", pnl: 1000 },
        { closedAt: "2026-01-02T00:00:00.000Z", pnl: -500 },
      ],
    });
    expect(computeMaxDrawdownFromCurve(curve)).toBeCloseTo(500 / 11000);
  });

  it("returns null max drawdown for empty curve", () => {
    expect(computeMaxDrawdownFromCurve([])).toBeNull();
  });
});
