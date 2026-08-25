import { describe, expect, it, vi } from "vitest";
import { AuthRetryableFetchError } from "@supabase/supabase-js";
import { publicAuthError } from "./errors";
import { compareSupabaseUrl, diagnoseAuth } from "./debug";

describe("publicAuthError", () => {
  it("does not disguise an unreachable Auth host as a credential error", () => {
    const error = new AuthRetryableFetchError("fetch failed", 0);
    expect(publicAuthError(error)).toMatch(/Cannot reach Supabase Auth/);
    expect(publicAuthError(error)).not.toBe("Invalid email or password.");
  });

  it("keeps invalid credentials as a credential error", () => {
    const error = {
      name: "AuthApiError",
      message: "Invalid login credentials",
      status: 400,
      code: "invalid_credentials",
    } as Parameters<typeof publicAuthError>[0];
    expect(publicAuthError(error)).toBe("Invalid email or password.");
  });
});

describe("auth debug diagnosis", () => {
  it("reports MATCH when URL aliases agree and the JWT ref matches", () => {
    const payload = Buffer.from(
      JSON.stringify({ ref: "abcdprojectref1234", role: "anon" }),
    ).toString("base64url");
    const key = `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
    expect(
      compareSupabaseUrl({
        SUPABASE_URL: "https://abcdprojectref1234.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: key,
      }),
    ).toBe("MATCH");
  });

  it("reports MISMATCH when the JWT project ref does not match the URL host", () => {
    const payload = Buffer.from(
      JSON.stringify({ ref: "otherprojectref0000", role: "anon" }),
    ).toString("base64url");
    const key = `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
    expect(
      compareSupabaseUrl({
        SUPABASE_URL: "https://abcdprojectref1234.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: key,
      }),
    ).toBe("MISMATCH");
  });

  it("returns the safe debug shape without secrets when Auth is unreachable", async () => {
    const report = await diagnoseAuth({
      env: {
        SUPABASE_URL: "https://missing-project.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      },
      fetchFn: vi.fn(async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch,
    });

    expect(report).toEqual({
      SUPABASE_URL: "MATCH",
      PUBLISHABLE_KEY: "FOUND",
      AUTH_EMAIL_PASSWORD: "UNKNOWN",
      USER_LOOKUP: "ERROR",
      SIGN_IN: "AUTH_ERROR",
      SESSION: "MISSING",
    });
    expect(JSON.stringify(report)).not.toContain("sb_publishable_test");
    expect(JSON.stringify(report)).not.toContain("missing-project");
  });
});
