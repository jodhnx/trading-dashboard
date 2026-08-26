import { describe, expect, it } from "vitest";
import { resolveMarketProvider } from "@/lib/env/resolve";

describe("provider factory resolution", () => {
  it("selects Twelve Data when auto and a key are present", () => {
    const result = resolveMarketProvider({
      MARKET_DATA_PROVIDER: "auto",
      TWELVE_DATA_API_KEY: "td-key",
      NODE_ENV: "production",
    });
    expect(result.providerId).toBe("twelve-data");
    expect(result.isMock).toBe(false);
  });

  it("uses mock in development when auto has no API key", () => {
    const result = resolveMarketProvider({
      MARKET_DATA_PROVIDER: "auto",
      NODE_ENV: "development",
    });
    expect(result).toMatchObject({ providerId: "mock", isMock: true });
  });

  it("does not silently mock in production when auto has no API key", () => {
    const result = resolveMarketProvider({
      MARKET_DATA_PROVIDER: "auto",
      NODE_ENV: "production",
    });
    expect(result).toMatchObject({ providerId: "unavailable", isMock: false });
  });

  it("rejects explicit mock in production", () => {
    expect(() =>
      resolveMarketProvider({
        MARKET_DATA_PROVIDER: "mock",
        NODE_ENV: "production",
      }),
    ).toThrow(/not allowed in production/);
  });

  it("allows explicit mock in development", () => {
    const result = resolveMarketProvider({
      MARKET_DATA_PROVIDER: "mock",
      NODE_ENV: "development",
    });
    expect(result).toMatchObject({ providerId: "mock", isMock: true });
  });

  it("requires a key for explicit twelve-data", () => {
    expect(() =>
      resolveMarketProvider({
        MARKET_DATA_PROVIDER: "twelve-data",
        NODE_ENV: "development",
      }),
    ).toThrow(/TWELVE_DATA_API_KEY/);
  });
});
