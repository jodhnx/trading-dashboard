import { describe, expect, it } from "vitest";
import { evaluateBarExit, realizedPnL, realizedPnLPercent } from "./calculations";

describe("backtest calculations", () => {
  it("LONG stop loss when low touches stop", () => {
    const exit = evaluateBarExit({
      side: "LONG",
      stopLoss: 95,
      takeProfit: 110,
      high: 100,
      low: 94,
    });
    expect(exit?.exitReason).toBe("STOP_LOSS");
    expect(exit?.exitPrice).toBe(95);
  });

  it("LONG take profit when high touches target", () => {
    const exit = evaluateBarExit({
      side: "LONG",
      stopLoss: 95,
      takeProfit: 110,
      high: 111,
      low: 100,
    });
    expect(exit?.exitReason).toBe("TAKE_PROFIT");
    expect(exit?.exitPrice).toBe(110);
  });

  it("same-candle stop and target uses STOP LOSS for LONG", () => {
    const exit = evaluateBarExit({
      side: "LONG",
      stopLoss: 98,
      takeProfit: 105,
      high: 106,
      low: 97,
    });
    expect(exit?.exitReason).toBe("STOP_LOSS");
    expect(exit?.exitPrice).toBe(98);
  });

  it("same-candle stop and target uses STOP LOSS for SHORT", () => {
    const exit = evaluateBarExit({
      side: "SHORT",
      stopLoss: 105,
      takeProfit: 90,
      high: 106,
      low: 89,
    });
    expect(exit?.exitReason).toBe("STOP_LOSS");
    expect(exit?.exitPrice).toBe(105);
  });

  it("computes LONG and SHORT realized P&L", () => {
    expect(
      realizedPnL({
        side: "LONG",
        entryPrice: 100,
        exitPrice: 110,
        quantity: 2,
      }),
    ).toBe(20);
    expect(
      realizedPnL({
        side: "SHORT",
        entryPrice: 100,
        exitPrice: 90,
        quantity: 2,
      }),
    ).toBe(20);
  });

  it("computes realized P&L percent", () => {
    expect(
      realizedPnLPercent({
        side: "LONG",
        entryPrice: 100,
        exitPrice: 110,
      }),
    ).toBeCloseTo(10);
  });
});
