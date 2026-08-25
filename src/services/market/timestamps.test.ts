import { describe, expect, it } from "vitest";
import { parseQuoteClock } from "./timestamps";

describe("quote clock parsing", () => {
  it("uses last_quote_at so date-only datetime is not shown as midnight", () => {
    const clock = parseQuoteClock({
      datetime: "2026-08-24",
      timestamp: 1787578200,
      last_quote_at: 1787587320,
    });
    expect(clock.toISOString()).toBe("2026-08-24T16:02:00.000Z");
    expect(
      clock.toLocaleTimeString("de-DE", {
        timeZone: "Europe/Berlin",
        hour: "2-digit",
        minute: "2-digit",
      }),
    ).not.toBe("02:00");
  });
});
