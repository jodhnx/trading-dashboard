import { describe, expect, it } from "vitest";
import { newsContentHash, newsIdentityKey } from "./hash";
import { dedupeByIdentity, dedupeNews } from "./dedupe";

describe("news deduplication", () => {
  const publishedAt = new Date("2026-08-24T12:00:00.000Z");

  it("hashes normalized title, source, and UTC day — not the URL", () => {
    const first = newsContentHash({
      title: "  NVIDIA Reports  Results ",
      sourceName: "Reuters",
      publishedAt,
      sourceUrl: "https://Example.com/a?utm_source=feed",
    });
    const second = newsContentHash({
      title: "nvidia reports results",
      sourceName: "reuters",
      publishedAt: new Date("2026-08-24T18:30:00.000Z"),
      sourceUrl: "https://example.com/a?id=other",
    });
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps different sources or days distinct", () => {
    const reuters = newsIdentityKey({
      title: "Nvidia Earnings, Jackson Hole and Other Key Things to Watch this Week",
      sourceName: "Yahoo Finance",
      publishedAt,
    });
    const bloomberg = newsIdentityKey({
      title: "Nvidia Earnings, Jackson Hole and Other Key Things to Watch this Week",
      sourceName: "Bloomberg",
      publishedAt,
    });
    const nextDay = newsIdentityKey({
      title: "Nvidia Earnings, Jackson Hole and Other Key Things to Watch this Week",
      sourceName: "Yahoo Finance",
      publishedAt: new Date("2026-08-25T12:00:00.000Z"),
    });
    expect(reuters).not.toBe(bloomberg);
    expect(reuters).not.toBe(nextDay);
  });

  it("collapses alternate URLs of the same story in a batch", () => {
    const unique = dedupeByIdentity([
      {
        title: "Nvidia Earnings, Jackson Hole and Other Key Things to Watch this Week",
        sourceName: "Yahoo Finance",
        publishedAt,
        sourceUrl: "https://finance.yahoo.com/a?utm_source=rss",
      },
      {
        title: "Nvidia Earnings, Jackson Hole and Other Key Things to Watch this Week",
        sourceName: "Yahoo Finance",
        publishedAt: new Date("2026-08-24T12:05:00.000Z"),
        sourceUrl: "https://finance.yahoo.com/a",
      },
      {
        title: "Bitcoin climbs after ETF inflows",
        sourceName: "Reuters",
        publishedAt,
        sourceUrl: "https://www.reuters.com/btc",
      },
    ]);
    expect(unique).toHaveLength(2);
    expect(unique[0]?.sourceUrl).toBe("https://finance.yahoo.com/a?utm_source=rss");
    expect(unique[1]?.title).toMatch(/Bitcoin/);
  });

  it("keeps the first copy of the same content hash", () => {
    const hash = newsContentHash({
      title: "Same",
      sourceName: "Wire",
      publishedAt,
      sourceUrl: "https://example.com/same",
    });
    const unique = dedupeNews([
      { contentHash: hash, title: "first" },
      { contentHash: hash, title: "second" },
      { contentHash: "other", title: "other" },
    ]);
    expect(unique).toEqual([
      { contentHash: hash, title: "first" },
      { contentHash: "other", title: "other" },
    ]);
  });
});
