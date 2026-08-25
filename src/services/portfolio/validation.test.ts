import { describe, expect, it } from "vitest";
import {
  cashUpdateSchema,
  holdingCreateSchema,
  holdingPatchSchema,
  isSupportedPortfolioSymbol,
} from "./validation";

describe("portfolio validation", () => {
  it("accepts a valid create payload", () => {
    const parsed = holdingCreateSchema.safeParse({
      symbol: "nvda",
      quantity: 10,
      averageEntryPrice: 180.5,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.symbol).toBe("NVDA");
      expect(parsed.data.quantity).toBe(10);
    }
  });

  it("rejects quantity edge cases", () => {
    for (const quantity of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, ""]) {
      expect(
        holdingCreateSchema.safeParse({
          symbol: "NVDA",
          quantity,
          averageEntryPrice: 10,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects price edge cases", () => {
    for (const averageEntryPrice of [
      0,
      -5,
      Number.NaN,
      Number.NEGATIVE_INFINITY,
    ]) {
      expect(
        holdingCreateSchema.safeParse({
          symbol: "NVDA",
          quantity: 1,
          averageEntryPrice,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects invalid symbols and unsupported watchlist symbols", () => {
    expect(
      holdingCreateSchema.safeParse({
        symbol: "drop table",
        quantity: 1,
        averageEntryPrice: 1,
      }).success,
    ).toBe(false);
    expect(isSupportedPortfolioSymbol("NVDA")).toBe(true);
    expect(isSupportedPortfolioSymbol("AAPL")).toBe(false);
  });

  it("requires at least one field on patch", () => {
    expect(holdingPatchSchema.safeParse({}).success).toBe(false);
    expect(
      holdingPatchSchema.safeParse({ quantity: 2 }).success,
    ).toBe(true);
  });

  it("validates cash updates", () => {
    expect(cashUpdateSchema.safeParse({ cash: 0 }).success).toBe(true);
    expect(cashUpdateSchema.safeParse({ cash: -1 }).success).toBe(false);
    expect(cashUpdateSchema.safeParse({ cash: Number.NaN }).success).toBe(
      false,
    );
  });
});
