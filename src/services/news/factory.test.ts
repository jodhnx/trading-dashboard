import { describe, expect, it } from "vitest";
import { resolveNewsProvider } from "@/lib/env/resolve";

describe("news provider factory resolution", () => {
  it("selects NewsAPI when auto and a key are present", () => {
    const result = resolveNewsProvider({
      NEWS_PROVIDER: "auto",
      NEWS_API_KEY: "news-key",
      NODE_ENV: "production",
    });
    expect(result.providerId).toBe("newsapi");
    expect(result.isMock).toBe(false);
  });

  it("selects NewsAPI in development when a key is present", () => {
    const result = resolveNewsProvider({
      NEWS_PROVIDER: "auto",
      NEWS_API_KEY: "news-key",
      NODE_ENV: "development",
    });
    expect(result.providerId).toBe("newsapi");
    expect(result.isMock).toBe(false);
  });

  it("uses mock in development when auto has no API key", () => {
    const result = resolveNewsProvider({
      NEWS_PROVIDER: "auto",
      NODE_ENV: "development",
    });
    expect(result).toMatchObject({ providerId: "mock", isMock: true });
  });

  it("does not silently mock in production when auto has no API key", () => {
    const result = resolveNewsProvider({
      NEWS_PROVIDER: "auto",
      NODE_ENV: "production",
    });
    expect(result).toMatchObject({ providerId: "unavailable", isMock: false });
  });
});
