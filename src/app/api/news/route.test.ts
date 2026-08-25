import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getAuthUser = vi.fn();
const listNews = vi.fn();
const fetchLatestNews = vi.fn();
const listResearch = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: () => getAuthUser(),
}));

vi.mock("@/services/news/create-service", () => ({
  createNewsService: () => ({ listNews, fetchLatestNews }),
}));

vi.mock("@/services/research/create-service", () => ({
  createResearchService: () => ({ list: listResearch }),
}));

import { GET as getNews } from "@/app/api/news/route";
import { POST as refreshNews } from "@/app/api/news/refresh/route";
import { GET as getResearch } from "@/app/api/research/route";
import { NewsUnavailableError } from "@/services/news/errors";

function newsRequest(query = "") {
  return new NextRequest(new URL(`http://localhost/api/news${query}`));
}

describe("GET /api/news", () => {
  beforeEach(() => {
    getAuthUser.mockReset();
    listNews.mockReset();
  });

  it("returns 401 without a session", async () => {
    getAuthUser.mockResolvedValue(null);
    const response = await getNews(newsRequest("?asset=NVDA"));
    expect(response.status).toBe(401);
    expect(listNews).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid parameters", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    const response = await getNews(newsRequest("?limit=nope"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("returns stored news for an authenticated user", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    listNews.mockResolvedValue({
      status: "LIVE",
      source: "newsapi",
      items: [
        {
          id: "1",
          title: "NVIDIA quarterly results",
          summary: "Results",
          sourceName: "Reuters",
          sourceUrl: "https://www.reuters.com/nvda",
          publishedAt: new Date("2026-08-24T12:00:00.000Z"),
          retrievedAt: new Date("2026-08-24T12:05:00.000Z"),
          assetSymbols: ["NVDA"],
          category: "EARNINGS",
          relevance: "HIGH",
          sentiment: "UNKNOWN",
          isMock: false,
          contentHash: "hash",
          assetId: "asset-1",
        },
      ],
    });
    const response = await getNews(newsRequest("?asset=NVDA&limit=20"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items[0].title).toBe("NVIDIA quarterly results");
    expect(body.items[0].sourceUrl).toBe("https://www.reuters.com/nvda");
    expect(listNews).toHaveBeenCalledWith(
      expect.objectContaining({ asset: "NVDA", limit: 20 }),
    );
  });
});

describe("POST /api/news/refresh", () => {
  beforeEach(() => {
    getAuthUser.mockReset();
    fetchLatestNews.mockReset();
  });

  it("returns 503 when the provider fails", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    fetchLatestNews.mockRejectedValue(new NewsUnavailableError("NEWS UNAVAILABLE"));
    const response = await refreshNews();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "NEWS UNAVAILABLE",
      code: "NEWS_UNAVAILABLE",
    });
  });

  it("returns 503 for unexpected ingest failures instead of an empty success", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    fetchLatestNews.mockRejectedValue(new Error("boom"));
    const response = await refreshNews();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "NEWS UNAVAILABLE",
    });
  });
});

describe("GET /api/research", () => {
  beforeEach(() => {
    getAuthUser.mockReset();
    listResearch.mockReset();
  });

  it("returns 401 without a session", async () => {
    getAuthUser.mockResolvedValue(null);
    const response = await getResearch(new NextRequest("http://localhost/api/research"));
    expect(response.status).toBe(401);
  });

  it("returns 400 for an invalid category", async () => {
    getAuthUser.mockResolvedValue({ id: "user-1" });
    const response = await getResearch(
      new NextRequest("http://localhost/api/research?category=BUY_SETUP"),
    );
    expect(response.status).toBe(400);
  });
});
