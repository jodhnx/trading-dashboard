import { describe, expect, it } from "vitest";
import { analyticsQuerySchema } from "./validation";

describe("analytics validation", () => {
  it("accepts preset and symbol filters", () => {
    expect(
      analyticsQuerySchema.safeParse({
        preset: "30D",
        symbol: "NVDA",
        dataset: "all",
      }).success,
    ).toBe(true);
  });

  it("rejects preset and custom dates together", () => {
    expect(
      analyticsQuerySchema.safeParse({
        preset: "30D",
        from: "2026-01-01",
        to: "2026-06-01",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid symbol filter", () => {
    expect(
      analyticsQuerySchema.safeParse({
        symbol: "FAKECOIN",
      }).success,
    ).toBe(false);
  });
});
