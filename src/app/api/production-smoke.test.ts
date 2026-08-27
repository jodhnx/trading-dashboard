import { describe, expect, it, vi } from "vitest";
import { GET as healthGet } from "@/app/api/health/route";

const verifyCronAuthorization = vi.fn();

vi.mock("@/services/pipeline/auth", () => ({
  verifyCronAuthorization: (...args: unknown[]) => verifyCronAuthorization(...args),
  isCronConfigured: () => true,
}));

vi.mock("@/services/pipeline/run-daily", () => ({
  runDailyPipeline: vi.fn(),
}));

describe("production smoke: health", () => {
  it("returns phase and provider configuration without secrets", async () => {
    const response = await healthGet();
    const payload = (await response.json()) as {
      ok: boolean;
      phase: number;
      version: string;
      supabase: { configured: boolean };
      marketData: { provider: string; configured: boolean };
      news: { provider: string; configured: boolean };
      openai: { configured: boolean };
      cron: { configured: boolean };
    };

    expect(response.status).toBe(200);
    expect(payload.phase).toBe(28);
    expect(payload.version).toMatch(/^0\.28/);
    expect(JSON.stringify(payload)).not.toMatch(/sk-/i);
    expect(JSON.stringify(payload)).not.toMatch(/service_role/i);
    expect(payload.supabase).toBeDefined();
    expect(payload.marketData).toBeDefined();
    expect(payload.news).toBeDefined();
    expect(payload.openai).toBeDefined();
    expect(payload.cron).toBeDefined();
  });
});

describe("production smoke: cron authorization", () => {
  it("rejects missing cron authorization", async () => {
    verifyCronAuthorization.mockReturnValue(false);
    const { GET } = await import("@/app/api/cron/daily-pipeline/route");
    const response = await GET(new Request("http://localhost/api/cron/daily-pipeline"));
    expect(response.status).toBe(401);
  });
});
