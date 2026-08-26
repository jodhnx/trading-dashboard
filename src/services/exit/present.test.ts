import { describe, expect, it } from "vitest";
import { toExitCandidate } from "./present";
import type { PositionExitAlert } from "./monitor";

describe("toExitCandidate", () => {
  it("maps exit fields without inventing prices", () => {
    const alert: PositionExitAlert = {
      positionId: "p1",
      symbol: "NVDA",
      side: "LONG",
      entryPrice: 100,
      currentPrice: 110,
      stopLoss: 95,
      takeProfit1: 110,
      takeProfit2: 120,
      evaluatedAt: "2026-08-26T12:00:00.000Z",
      evaluation: {
        state: "PARTIAL_TAKE_PROFIT",
        urgency: "TAKE_PROFIT",
        reasons: ["Take-profit 1 reached — consider partial profits"],
        unrealizedPnLPercent: 10,
        distanceToStopPercent: 15.79,
        distanceToTargetPercent: 9.09,
        trailingStop: 98,
      },
    };
    const candidate = toExitCandidate(alert);
    expect(candidate.exitAction).toBe("PARTIAL_TAKE_PROFIT");
    expect(candidate.currentPrice).toBe(110);
    expect(candidate.entryPrice).toBe(100);
    expect(candidate.unrealizedPnLPercent).toBe(10);
    expect(candidate.distanceToTP1).toBe(0);
    expect(candidate.exitReason).toMatch(/Take-profit 1/);
  });
});
