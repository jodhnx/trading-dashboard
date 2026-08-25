import { describe, expect, it } from "vitest";
import {
  isBriefStale,
  isValidBriefDate,
  parseBriefDateParam,
  utcBriefDate,
  briefDayBoundsUtc,
} from "./date";

describe("daily brief dates", () => {
  it("validates YYYY-MM-DD calendar dates", () => {
    expect(isValidBriefDate("2026-08-25")).toBe(true);
    expect(isValidBriefDate("2026-02-30")).toBe(false);
    expect(isValidBriefDate("08-25-2026")).toBe(false);
    expect(isValidBriefDate("")).toBe(false);
  });

  it("defaults to the UTC trading date", () => {
    const now = new Date("2026-08-25T22:15:00.000Z");
    expect(utcBriefDate(now)).toBe("2026-08-25");
    expect(parseBriefDateParam(null, now)).toEqual({
      ok: true,
      date: "2026-08-25",
    });
    expect(parseBriefDateParam("2026-08-24", now)).toEqual({
      ok: true,
      date: "2026-08-24",
    });
    expect(parseBriefDateParam("nope", now).ok).toBe(false);
  });

  it("builds UTC day bounds", () => {
    const bounds = briefDayBoundsUtc("2026-08-25");
    expect(bounds.start.toISOString()).toBe("2026-08-25T00:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-08-25T23:59:59.999Z");
  });

  it("marks past brief dates as stale", () => {
    const now = new Date("2026-08-25T12:00:00.000Z");
    expect(
      isBriefStale({
        briefDate: "2026-08-24",
        generatedAt: "2026-08-24T10:00:00.000Z",
        now,
      }),
    ).toBe(true);
    expect(
      isBriefStale({
        briefDate: "2026-08-25",
        generatedAt: "2026-08-25T10:00:00.000Z",
        now,
        staleAfterHours: 36,
      }),
    ).toBe(false);
  });
});
