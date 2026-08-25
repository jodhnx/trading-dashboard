import { describe, expect, it } from "vitest";
import {
  aggregateEquity,
  evaluateExitTrigger,
  realizedPnL,
  realizedPnLPercent,
  unrealizedPnL,
} from "./calculations";

describe("paper calculations", () => {
  it("computes LONG profit", () => {
    expect(
      realizedPnL({ side: "LONG", entryPrice: 100, exitPrice: 110, quantity: 10 }),
    ).toBe(100);
  });

  it("computes SHORT profit", () => {
    expect(
      realizedPnL({ side: "SHORT", entryPrice: 100, exitPrice: 90, quantity: 10 }),
    ).toBe(100);
  });

  it("computes LONG loss", () => {
    expect(
      realizedPnL({ side: "LONG", entryPrice: 100, exitPrice: 90, quantity: 10 }),
    ).toBe(-100);
  });

  it("computes SHORT loss", () => {
    expect(
      realizedPnL({ side: "SHORT", entryPrice: 100, exitPrice: 110, quantity: 10 }),
    ).toBe(-100);
  });

  it("computes unrealized P&L", () => {
    expect(
      unrealizedPnL({
        side: "LONG",
        entryPrice: 212,
        currentPrice: 214.5,
        quantity: 10,
      }),
    ).toBeCloseTo(25, 5);
  });

  it("aggregates equity from cash and open market values", () => {
    expect(
      aggregateEquity({
        cashBalance: 8000,
        openMarketValues: [2200],
      }),
    ).toEqual({ invested: 2200, equity: 10200 });
  });

  it("returns null equity when any market value is missing", () => {
    expect(
      aggregateEquity({
        cashBalance: 8000,
        openMarketValues: [2200, null],
      }),
    ).toEqual({ invested: null, equity: null });
  });

  it("triggers LONG stop loss and take profit", () => {
    expect(
      evaluateExitTrigger({
        side: "LONG",
        stopLoss: 205,
        takeProfit: 225,
        currentPrice: 204,
      }),
    ).toBe("STOP_LOSS");
    expect(
      evaluateExitTrigger({
        side: "LONG",
        stopLoss: 205,
        takeProfit: 225,
        currentPrice: 226,
      }),
    ).toBe("TAKE_PROFIT");
  });

  it("triggers SHORT stop loss and take profit", () => {
    expect(
      evaluateExitTrigger({
        side: "SHORT",
        stopLoss: 110,
        takeProfit: 90,
        currentPrice: 111,
      }),
    ).toBe("STOP_LOSS");
    expect(
      evaluateExitTrigger({
        side: "SHORT",
        stopLoss: 110,
        takeProfit: 90,
        currentPrice: 89,
      }),
    ).toBe("TAKE_PROFIT");
  });

  it("computes realized percent", () => {
    expect(
      realizedPnLPercent({ side: "LONG", entryPrice: 100, exitPrice: 110 }),
    ).toBeCloseTo(10, 5);
  });
});
