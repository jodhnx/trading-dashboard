import { describe, expect, it } from "vitest";
import { BACKTEST_MAX_RANGE_DAYS } from "./constants";
import { backtestRequestSchema } from "./validation";

describe("backtest validation", () => {
  it("accepts valid request", () => {
    expect(
      backtestRequestSchema.safeParse({
        symbol: "NVDA",
        timeframe: "1day",
        from: "2024-01-01",
        to: "2024-06-01",
        startingCapital: 10000,
      }).success,
    ).toBe(true);
  });

  it("rejects from >= to", () => {
    const result = backtestRequestSchema.safeParse({
      symbol: "NVDA",
      timeframe: "1day",
      from: "2024-06-01",
      to: "2024-01-01",
      startingCapital: 10000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects excessive date range", () => {
    const result = backtestRequestSchema.safeParse({
      symbol: "NVDA",
      timeframe: "1day",
      from: "2020-01-01",
      to: "2026-01-01",
      startingCapital: 10000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("to"))).toBe(
        true,
      );
    }
  });

  it("rejects invalid symbol and capital", () => {
    expect(
      backtestRequestSchema.safeParse({
        symbol: "",
        timeframe: "1day",
        from: "2024-01-01",
        to: "2024-06-01",
        startingCapital: 10000,
      }).success,
    ).toBe(false);
    expect(
      backtestRequestSchema.safeParse({
        symbol: "NVDA",
        timeframe: "1day",
        from: "2024-01-01",
        to: "2024-06-01",
        startingCapital: 10,
      }).success,
    ).toBe(false);
  });

  it("allows range up to max days", () => {
    const from = new Date("2024-01-01T00:00:00.000Z");
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + BACKTEST_MAX_RANGE_DAYS - 1);
    expect(
      backtestRequestSchema.safeParse({
        symbol: "NVDA",
        timeframe: "1day",
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        startingCapital: 10000,
      }).success,
    ).toBe(true);
  });
});
