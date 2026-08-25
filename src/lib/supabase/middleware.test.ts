import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: (...args: unknown[]) => getUser(...args),
    },
  })),
}));

vi.mock("@/lib/env/public", () => ({
  getPublicEnv: () => ({
    supabaseConfigured: true,
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "publishable-key",
  }),
}));

vi.mock("@/lib/env/resolve", () => ({
  requirePublicSupabase: () => ({
    url: "https://example.supabase.co",
    publishableKey: "publishable-key",
  }),
}));

import { updateSession } from "./middleware";

describe("updateSession", () => {
  beforeEach(() => {
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: null } });
  });

  it("lets the cron pipeline through without a Supabase session", async () => {
    const response = await updateSession(
      new NextRequest("http://localhost/api/cron/daily-pipeline", {
        method: "POST",
      }),
    );

    expect(response.status).not.toBe(401);
    expect(await response.json().catch(() => null)).toBeNull();
  });

  it("still blocks protected API routes without a session", async () => {
    const response = await updateSession(
      new NextRequest("http://localhost/api/settings"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  });
});
