import { describe, expect, it } from "vitest";
import { evaluateExitState } from "./engine";

describe("evaluateExitState", () => {
  it("returns STOP_LOSS when price breaches stop", () => {
    const result = evaluateExitState({
      side: "LONG",
      entryPrice: 100,
      currentPrice: 94,
      stopLoss: 95,
      takeProfit: 110,
    });
    expect(result.state).toBe("STOP_LOSS");
    expect(result.urgency).toBe("URGENT_EXIT");
  });

  it("returns PARTIAL_TAKE_PROFIT at TP1", () => {
    const result = evaluateExitState({
      side: "LONG",
      entryPrice: 100,
      currentPrice: 110,
      stopLoss: 95,
      takeProfit: 110,
      takeProfit2: 120,
    });
    expect(result.state).toBe("PARTIAL_TAKE_PROFIT");
  });

  it("returns HOLD when thesis intact", () => {
    const result = evaluateExitState({
      side: "LONG",
      entryPrice: 100,
      currentPrice: 102,
      stopLoss: 95,
      takeProfit: 110,
      trend: "BULLISH",
      momentum: "POSITIVE",
    });
    expect(result.state).toBe("HOLD");
  });

  it("marks thesis invalidation as urgent exit", () => {
    const result = evaluateExitState({
      side: "LONG",
      entryPrice: 100,
      currentPrice: 101,
      stopLoss: 95,
      takeProfit: 110,
      thesisInvalidated: true,
    });
    expect(result.state).toBe("THESIS_INVALIDATED");
    expect(result.urgency).toBe("URGENT_EXIT");
  });
});
