import { describe, expect, it } from "vitest";
import { resolveAnalyticsDateRange, isTimestampInRange } from "./date";

describe("analytics date filters", () => {
  const referenceDate = new Date("2026-08-24T12:00:00.000Z");

  it("resolves preset ranges deterministically", () => {
    expect(resolveAnalyticsDateRange({ preset: "7D", referenceDate })).toEqual({
      preset: "7D",
      from: "2026-08-17",
      to: "2026-08-24",
    });
    expect(resolveAnalyticsDateRange({ preset: "YTD", referenceDate }).from).toBe("2026-01-01");
    expect(resolveAnalyticsDateRange({ preset: "ALL", referenceDate })).toEqual({
      preset: "ALL",
      from: null,
      to: null,
    });
  });

  it("supports custom ranges", () => {
    expect(
      resolveAnalyticsDateRange({
        from: "2026-01-01",
        to: "2026-06-01",
      }),
    ).toEqual({
      preset: "CUSTOM",
      from: "2026-01-01",
      to: "2026-06-01",
    });
  });

  it("filters timestamps within range", () => {
    const range = { preset: "30D" as const, from: "2026-08-01", to: "2026-08-24" };
    expect(isTimestampInRange("2026-08-10T12:00:00.000Z", range)).toBe(true);
    expect(isTimestampInRange("2026-07-01T12:00:00.000Z", range)).toBe(false);
  });
});
