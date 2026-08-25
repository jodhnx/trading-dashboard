import { describe, expect, it } from "vitest";
import {
  isAuthEntryPath,
  isPublicPath,
  unauthorizedPayload,
} from "./routes";

describe("route protection helpers", () => {
  it("allows login, health, and cron pipeline as public middleware paths", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/login/reset")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/api/cron/daily-pipeline")).toBe(true);
    expect(isPublicPath("/api/auth/debug")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/settings")).toBe(false);
    expect(isPublicPath("/api/settings")).toBe(false);
    expect(isPublicPath("/api/market/quote")).toBe(false);
    expect(isPublicPath("/api/news")).toBe(false);
    expect(isPublicPath("/api/research")).toBe(false);
    expect(isPublicPath("/api/ai/analyze")).toBe(false);
    expect(isPublicPath("/api/daily-brief")).toBe(false);
    expect(isPublicPath("/api/daily-brief/generate")).toBe(false);
  });

  it("treats login as an auth entry path", () => {
    expect(isAuthEntryPath("/login")).toBe(true);
    expect(isAuthEntryPath("/settings")).toBe(false);
  });

  it("returns a stable unauthorized payload without private data", () => {
    expect(unauthorizedPayload()).toEqual({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  });
});
