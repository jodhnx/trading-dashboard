import { describe, expect, it } from "vitest";
import { EnvValidationError } from "./errors";
import {
  publicEnvKeys,
  resolveMarketProvider,
  resolveNewsProvider,
  resolvePublicEnv,
  resolveSecretEnv,
  requirePublicSupabase,
} from "./resolve";

describe("environment resolution", () => {
  it("prefers publishable/secret names over legacy aliases", () => {
    const publicEnv = resolvePublicEnv({
      SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_URL: "https://legacy.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_current",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy-anon",
    });
    const secretEnv = resolveSecretEnv({
      SUPABASE_SECRET_KEY: "sb_secret_current",
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service",
    });

    expect(publicEnv.supabaseUrl).toBe("https://example.supabase.co");
    expect(publicEnv.supabasePublishableKey).toBe("sb_publishable_current");
    expect(publicEnv.supabaseConfigured).toBe(true);
    expect(secretEnv.supabaseSecretKey).toBe("sb_secret_current");
  });

  it("falls back to legacy anon and service role names", () => {
    const publicEnv = resolvePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://legacy.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy-anon",
    });
    const secretEnv = resolveSecretEnv({
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service",
    });

    expect(publicEnv.supabasePublishableKey).toBe("legacy-anon");
    expect(secretEnv.supabaseSecretKey).toBe("legacy-service");
  });

  it("does not put secrets on the public env object", () => {
    const publicEnv = resolvePublicEnv({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "pub",
      SUPABASE_SECRET_KEY: "should-not-appear",
    });

    expect(publicEnvKeys(publicEnv)).toEqual([
      "supabaseUrl",
      "supabasePublishableKey",
      "supabaseConfigured",
    ]);
    expect(JSON.stringify(publicEnv)).not.toContain("should-not-appear");
  });

  it("treats empty strings as missing", () => {
    const publicEnv = resolvePublicEnv({
      SUPABASE_URL: "   ",
      SUPABASE_PUBLISHABLE_KEY: "",
    });
    expect(publicEnv.supabaseConfigured).toBe(false);
    expect(() => requirePublicSupabase(publicEnv)).toThrow(EnvValidationError);
  });

  it("uses mock market data when no Twelve Data key is set in development", () => {
    const result = resolveMarketProvider({
      MARKET_DATA_PROVIDER: "auto",
      NODE_ENV: "development",
    });
    expect(result).toMatchObject({ providerId: "mock", isMock: true });
  });

  it("does not silently use mock in production without a key", () => {
    const result = resolveMarketProvider({
      MARKET_DATA_PROVIDER: "auto",
      NODE_ENV: "production",
    });
    expect(result.providerId).toBe("unavailable");
    expect(result.isMock).toBe(false);
  });

  it("selects Twelve Data when a key is present", () => {
    const result = resolveMarketProvider({
      MARKET_DATA_PROVIDER: "auto",
      TWELVE_DATA_API_KEY: "td-key",
    });
    expect(result.providerId).toBe("twelve-data");
    expect(result.isMock).toBe(false);
  });

  it("uses mock news in development when NEWS_API_KEY is missing", () => {
    const result = resolveNewsProvider({
      NEWS_PROVIDER: "auto",
      NODE_ENV: "development",
    });
    expect(result).toMatchObject({ providerId: "mock", isMock: true });
  });

  it("does not silently mock news in production without a key", () => {
    const result = resolveNewsProvider({
      NEWS_PROVIDER: "auto",
      NODE_ENV: "production",
    });
    expect(result.providerId).toBe("unavailable");
    expect(result.isMock).toBe(false);
  });

  it("selects NewsAPI when a key is present", () => {
    const result = resolveNewsProvider({
      NEWS_PROVIDER: "auto",
      NEWS_API_KEY: "news-key",
    });
    expect(result.providerId).toBe("newsapi");
    expect(result.isMock).toBe(false);
  });

  it("selects NewsAPI from the NEWSAPI_API_KEY alias", () => {
    const result = resolveNewsProvider({
      NEWS_PROVIDER: "auto",
      NEWSAPI_API_KEY: "news-key",
      NODE_ENV: "development",
    });
    expect(result.providerId).toBe("newsapi");
    expect(result.isMock).toBe(false);
  });

  it("fails clearly when newsapi is forced without a key", () => {
    expect(() => resolveNewsProvider({ NEWS_PROVIDER: "newsapi" })).toThrow(
      /NEWS_API_KEY/,
    );
  });

  it("fails clearly when twelve-data is forced without a key", () => {
    expect(() =>
      resolveMarketProvider({ MARKET_DATA_PROVIDER: "twelve-data" }),
    ).toThrow(/TWELVE_DATA_API_KEY/);
  });
});
