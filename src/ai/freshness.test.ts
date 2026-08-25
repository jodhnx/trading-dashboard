import { describe, expect, it } from "vitest";
import { classifyNewsFreshness } from "./freshness";

describe("classifyNewsFreshness", () => {
  const now = new Date("2026-08-24T18:00:00.000Z");

  it("marks news from the last day as CURRENT", () => {
    expect(
      classifyNewsFreshness(new Date("2026-08-24T10:00:00.000Z"), now),
    ).toBe("CURRENT");
  });

  it("marks week-old news as RECENT", () => {
    expect(
      classifyNewsFreshness(new Date("2026-08-20T18:00:00.000Z"), now),
    ).toBe("RECENT");
  });

  it("marks month-old news as OLDER", () => {
    expect(
      classifyNewsFreshness(new Date("2026-08-01T18:00:00.000Z"), now),
    ).toBe("OLDER");
  });

  it("marks stale news", () => {
    expect(
      classifyNewsFreshness(new Date("2026-01-01T00:00:00.000Z"), now),
    ).toBe("STALE");
  });
});
