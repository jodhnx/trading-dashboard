import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isCronConfigured, verifyCronAuthorization } from "./auth";

describe("verifyCronAuthorization", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    delete process.env.CRON_SECRET;
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
    vi.unstubAllEnvs();
  });

  it("allows requests in development when CRON_SECRET is unset", () => {
    vi.stubEnv("NODE_ENV", "development");
    const request = new Request("http://localhost/api/cron/daily-pipeline", {
      method: "POST",
    });
    expect(verifyCronAuthorization(request)).toBe(true);
  });

  it("rejects unauthorized requests when CRON_SECRET is configured", () => {
    process.env.CRON_SECRET = "test-secret";
    const request = new Request("http://localhost/api/cron/daily-pipeline", {
      method: "POST",
    });
    expect(verifyCronAuthorization(request)).toBe(false);
  });

  it("accepts a valid bearer token", () => {
    process.env.CRON_SECRET = "test-secret";
    const request = new Request("http://localhost/api/cron/daily-pipeline", {
      method: "POST",
      headers: { Authorization: "Bearer test-secret" },
    });
    expect(verifyCronAuthorization(request)).toBe(true);
  });

  it("rejects malformed authorization", () => {
    process.env.CRON_SECRET = "test-secret";
    const request = new Request("http://localhost/api/cron/daily-pipeline", {
      method: "POST",
      headers: { Authorization: "Basic test-secret" },
    });
    expect(verifyCronAuthorization(request)).toBe(false);
  });

  it("rejects production requests without CRON_SECRET", () => {
    vi.stubEnv("NODE_ENV", "production");
    const request = new Request("http://localhost/api/cron/daily-pipeline", {
      method: "POST",
      headers: { Authorization: "Bearer anything" },
    });
    expect(verifyCronAuthorization(request)).toBe(false);
  });

  it("reports cron configuration without exposing the secret", () => {
    process.env.CRON_SECRET = "hidden-secret";
    expect(isCronConfigured()).toBe(true);
    expect(JSON.stringify({ configured: isCronConfigured() })).not.toMatch(
      /hidden-secret/,
    );
  });
});
