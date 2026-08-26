import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyCronAuthorization = vi.fn();
const runDailyPipeline = vi.fn();

vi.mock("@/services/pipeline/auth", () => ({
  verifyCronAuthorization: (...args: unknown[]) => verifyCronAuthorization(...args),
}));

vi.mock("@/services/pipeline/run-daily", () => ({
  runDailyPipeline: (...args: unknown[]) => runDailyPipeline(...args),
}));

import { GET, POST } from "./route";

describe("POST /api/cron/daily-pipeline", () => {
  beforeEach(() => {
    verifyCronAuthorization.mockReset();
    runDailyPipeline.mockReset();
  });

  it("returns 401 for unauthorized requests at the route layer", async () => {
    verifyCronAuthorization.mockReturnValue(false);
    const response = await POST(
      new Request("http://localhost/api/cron/daily-pipeline", { method: "POST" }),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unauthorized",
    });
    expect(runDailyPipeline).not.toHaveBeenCalled();
  });

  it("returns pipeline summary without secrets", async () => {
    verifyCronAuthorization.mockReturnValue(true);
    runDailyPipeline.mockResolvedValue({
      status: "SUCCESS",
      date: "2026-08-25",
      durationMs: 1000,
      assetsProcessed: 6,
      market: { live: 5, cached: 0, stale: 0, mock: 0, unavailable: 1, assets: [] },
      news: { fetched: true, inserted: 2, duplicates: 1 },
      technical: { processed: 5, unavailable: 1 },
      ai: { requested: 1, completed: 1, reused: 0, skipped: 4, unavailable: 0 },
      brief: { usersProcessed: 1, created: 1, alreadyExists: 0, failed: 0, users: [] },
    });

    const response = await POST(
      new Request("http://localhost/api/cron/daily-pipeline", {
        method: "POST",
        headers: { Authorization: "Bearer test-secret" },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("SUCCESS");
    expect(JSON.stringify(body)).not.toMatch(/CRON_SECRET|sk-|SUPABASE_SECRET/);
  });

  it("returns 409 when the pipeline is skipped due to lock contention", async () => {
    verifyCronAuthorization.mockReturnValue(true);
    runDailyPipeline.mockResolvedValue({
      status: "SKIPPED",
      date: "2026-08-25",
      durationMs: 10,
      assetsProcessed: 0,
      market: { live: 0, cached: 0, stale: 0, mock: 0, unavailable: 0, assets: [] },
      news: { fetched: false, inserted: 0, duplicates: 0 },
      technical: { processed: 0, unavailable: 0 },
      ai: { requested: 0, completed: 0, reused: 0, skipped: 0, unavailable: 0 },
      brief: { usersProcessed: 0, created: 0, alreadyExists: 0, failed: 0, users: [] },
      lock: { acquired: false, reason: "Pipeline already running" },
    });
    const response = await POST(
      new Request("http://localhost/api/cron/daily-pipeline", { method: "POST" }),
    );
    expect(response.status).toBe(409);
  });
});

describe("GET /api/cron/daily-pipeline (Vercel Cron)", () => {
  beforeEach(() => {
    verifyCronAuthorization.mockReset();
    runDailyPipeline.mockReset();
  });

  it("accepts authorized GET the same way Vercel Cron invokes the route", async () => {
    verifyCronAuthorization.mockReturnValue(true);
    runDailyPipeline.mockResolvedValue({
      status: "PARTIAL",
      date: "2026-08-26",
      durationMs: 100,
      assetsProcessed: 23,
      market: { live: 20, cached: 0, stale: 0, mock: 0, unavailable: 3, assets: [] },
      news: { fetched: true, inserted: 0, duplicates: 1 },
      technical: { processed: 20, unavailable: 3 },
      ai: { requested: 0, completed: 0, reused: 0, skipped: 6, unavailable: 0 },
      opportunities: {
        scanned: 23,
        topStocks: 2,
        topCrypto: 1,
        persisted: 3,
        noHighConfidence: false,
        marketRegime: "BULL",
      },
      brief: { usersProcessed: 1, created: 1, alreadyExists: 0, failed: 0, users: [] },
    });

    const response = await GET(
      new Request("http://localhost/api/cron/daily-pipeline", {
        method: "GET",
        headers: { Authorization: "Bearer test-secret" },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe("PARTIAL");
    expect(runDailyPipeline).toHaveBeenCalledTimes(1);
  });

  it("returns 401 for GET without valid authorization", async () => {
    verifyCronAuthorization.mockReturnValue(false);
    const response = await GET(
      new Request("http://localhost/api/cron/daily-pipeline", { method: "GET" }),
    );
    expect(response.status).toBe(401);
    expect(runDailyPipeline).not.toHaveBeenCalled();
  });
});
