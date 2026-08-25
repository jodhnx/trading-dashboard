import { beforeEach, describe, expect, it } from "vitest";
import {
  beginBriefRequest,
  briefRequestKey,
  endBriefRequest,
  resetBriefRequests,
} from "./request-guard";

describe("brief request guard", () => {
  beforeEach(() => {
    resetBriefRequests();
  });

  it("blocks duplicate in-flight generation", () => {
    const key = briefRequestKey("user-1", "2026-08-25");
    expect(beginBriefRequest(key)).toBe(true);
    expect(beginBriefRequest(key)).toBe(false);
    endBriefRequest(key);
    expect(beginBriefRequest(key)).toBe(true);
  });
});
