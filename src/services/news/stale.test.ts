import { describe, expect, it } from "vitest";
import { isNewsStale } from "./stale";

describe("news stale detection", () => {
  const now = new Date("2026-08-24T16:00:00.000Z");

  it("marks items older than the configured window as STALE without deleting them", () => {
    const fresh = new Date("2026-08-24T10:00:00.000Z");
    const stale = new Date("2026-08-23T15:00:00.000Z");
    expect(isNewsStale(fresh, now, 24 * 60 * 60_000)).toBe(false);
    expect(isNewsStale(stale, now, 24 * 60 * 60_000)).toBe(true);
  });
});
