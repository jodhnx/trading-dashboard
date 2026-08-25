import { describe, expect, it } from "vitest";
import { validateRawNews } from "./validation";

describe("news validation", () => {
  const publishedAt = new Date("2026-08-24T12:00:00.000Z");

  it("accepts complete source-backed items", () => {
    const parsed = validateRawNews({
      title: "NVIDIA reports results",
      sourceName: "Reuters",
      sourceUrl: "https://www.reuters.com/example",
      publishedAt: publishedAt.toISOString(),
      summary: "Company results",
    });
    expect(parsed).toMatchObject({
      title: "NVIDIA reports results",
      sourceName: "Reuters",
      sourceUrl: "https://www.reuters.com/example",
    });
  });

  it("drops items missing title, source, url, or publishedAt", () => {
    expect(
      validateRawNews({
        title: "",
        sourceName: "Reuters",
        sourceUrl: "https://example.com/a",
        publishedAt,
      }),
    ).toBeNull();
    expect(
      validateRawNews({
        title: "Hello",
        sourceName: "",
        sourceUrl: "https://example.com/a",
        publishedAt,
      }),
    ).toBeNull();
    expect(
      validateRawNews({
        title: "Hello",
        sourceName: "Reuters",
        sourceUrl: "not-a-url",
        publishedAt,
      }),
    ).toBeNull();
    expect(
      validateRawNews({
        title: "Hello",
        sourceName: "Reuters",
        sourceUrl: "https://example.com/a",
        publishedAt: "not-a-date",
      }),
    ).toBeNull();
  });

  it("does not invent URLs or timestamps and rejects removed articles", () => {
    expect(
      validateRawNews({
        title: "[Removed]",
        sourceName: "Unknown",
        sourceUrl: "https://removed.com",
        publishedAt,
      }),
    ).toBeNull();
    expect(
      validateRawNews({
        title: "Hello",
        sourceName: "Reuters",
        sourceUrl: "javascript:alert(1)",
        publishedAt,
      }),
    ).toBeNull();
  });
});
