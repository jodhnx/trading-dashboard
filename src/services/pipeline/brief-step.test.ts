import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generateDailyBrief = vi.fn();

vi.mock("@/services/daily-brief/generate", () => ({
  generateDailyBrief: (...args: unknown[]) => generateDailyBrief(...args),
}));

import { runPipelineBriefForUser } from "./brief-step";

describe("runPipelineBriefForUser", () => {
  beforeEach(() => {
    generateDailyBrief.mockReset();
  });

  it("uses admin persistence for cron brief generation", async () => {
    generateDailyBrief.mockResolvedValue({
      ok: true,
      brief: { id: "brief-1" },
    });

    await runPipelineBriefForUser({
      userId: "user-1",
      email: "a@b.c",
      briefDate: "2026-08-25",
    });

    expect(generateDailyBrief).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        persistence: "admin",
      }),
    );
  });
});
