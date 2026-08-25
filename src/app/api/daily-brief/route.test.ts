import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";

const getAuthUser = vi.fn();
const findBriefByDate = vi.fn();
const listBriefHistory = vi.fn();
const generateDailyBrief = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: () => getAuthUser(),
}));

vi.mock("@/services/daily-brief", () => ({
  findBriefByDate: (...args: unknown[]) => findBriefByDate(...args),
  listBriefHistory: (...args: unknown[]) => listBriefHistory(...args),
  parseBriefDateParam: (raw: string | null | undefined) => {
    if (!raw) return { ok: true as const, date: "2026-08-25" };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return { ok: false as const, error: "Invalid date" };
    }
    return { ok: true as const, date: raw };
  },
}));

vi.mock("@/services/daily-brief/generate", () => ({
  generateDailyBrief: (...args: unknown[]) => generateDailyBrief(...args),
}));

import { GET } from "@/app/api/daily-brief/route";
import { POST } from "@/app/api/daily-brief/generate/route";

function getRequest(query = "") {
  return new NextRequest(`http://localhost/api/daily-brief${query}`);
}

function postRequest(body: unknown = {}) {
  return new NextRequest("http://localhost/api/daily-brief/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/daily-brief", () => {
  beforeEach(() => {
    getAuthUser.mockReset();
    findBriefByDate.mockReset();
    listBriefHistory.mockReset();
  });

  it("returns 401 without a session", async () => {
    getAuthUser.mockResolvedValue(null);
    const response = await GET(getRequest());
    expect(response.status).toBe(401);
    expect(findBriefByDate).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid date", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    const response = await GET(getRequest("?date=nope"));
    expect(response.status).toBe(400);
  });

  it("returns 404 when no brief is stored", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    findBriefByDate.mockResolvedValue(null);
    const response = await GET(getRequest("?date=2026-08-25"));
    expect(response.status).toBe(404);
    expect(findBriefByDate).toHaveBeenCalledWith({
      userId: "user-1",
      briefDate: "2026-08-25",
    });
  });

  it("returns the stored brief for the authenticated user", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    findBriefByDate.mockResolvedValue({
      id: "b1",
      userId: "user-1",
      briefDate: "2026-08-25",
      finalStatus: "NO_TRADE",
      summary: "Stored",
      topOpportunities: [],
    });
    const response = await GET(getRequest("?date=2026-08-25"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.brief.summary).toBe("Stored");
    expect(findBriefByDate).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-2" }),
    );
  });

  it("returns history for the authenticated user only", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    listBriefHistory.mockResolvedValue([]);
    const response = await GET(getRequest("?history=1&limit=10"));
    expect(response.status).toBe(200);
    expect(listBriefHistory).toHaveBeenCalledWith({
      userId: "user-1",
      limit: 10,
    });
  });
});

describe("POST /api/daily-brief/generate", () => {
  beforeEach(() => {
    getAuthUser.mockReset();
    generateDailyBrief.mockReset();
  });

  it("returns 401 without a session", async () => {
    getAuthUser.mockResolvedValue(null);
    const response = await POST(postRequest());
    expect(response.status).toBe(401);
    expect(generateDailyBrief).not.toHaveBeenCalled();
  });

  it("returns 409 when a brief already exists", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: "a@b.c" });
    generateDailyBrief.mockResolvedValue({
      ok: false,
      code: "BRIEF_EXISTS",
      error: "Daily Brief already exists for 2026-08-25",
    });
    const response = await POST(postRequest({ date: "2026-08-25" }));
    expect(response.status).toBe(409);
  });

  it("returns 200 with a generated brief", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1", email: "a@b.c" });
    generateDailyBrief.mockResolvedValue({
      ok: true,
      brief: {
        id: "b1",
        briefDate: "2026-08-25",
        finalStatus: "NO_TRADE",
        summary: "Generated",
        topOpportunities: [],
      },
    });
    const response = await POST(postRequest({}));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.brief.summary).toBe("Generated");
    expect(JSON.stringify(body)).not.toMatch(/OPENAI_API_KEY|sk-/);
  });
});

describe("Daily Brief UI / page load", () => {
  it("does not call OpenAI or generate on page module load paths", () => {
    const page = readFileSync(
      path.join(process.cwd(), "src/app/(app)/daily-brief/page.tsx"),
      "utf8",
    );
    const dashboard = readFileSync(
      path.join(process.cwd(), "src/app/(app)/page.tsx"),
      "utf8",
    );
    const view = readFileSync(
      path.join(process.cwd(), "src/components/daily-brief/daily-brief-view.tsx"),
      "utf8",
    );
    expect(page).toMatch(/findBriefByDate/);
    expect(page).not.toMatch(/generateDailyBrief|assembleDailyBriefInput|openai\.com/);
    expect(dashboard).toMatch(/loadDashboard/);
    expect(dashboard).not.toMatch(/generateDailyBrief|createOpenAiClient|createMarketDataService|createNewsService/);
    expect(view).toMatch(/Generate Today/);
    expect(view).toMatch(/method: "POST"/);
    expect(view).not.toMatch(/useEffect/);
    expect(view).not.toMatch(/OPENAI_API_KEY/);
  });
});
