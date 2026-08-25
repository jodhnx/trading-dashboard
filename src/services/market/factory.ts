import "server-only";

import { getMarketProviderInfo } from "@/lib/env/public";
import { getSecretEnv } from "@/lib/env/server";
import { EnvValidationError } from "@/lib/env/errors";
import { MockMarketDataProvider } from "./mock-provider";
import type { MarketDataProvider } from "./provider";
import { TwelveDataProvider } from "./twelve-data-provider";

export function createMarketDataProvider(): MarketDataProvider {
  const info = getMarketProviderInfo();

  if (info.providerId === "unavailable") {
    throw new EnvValidationError(
      "TWELVE_DATA_API_KEY is required in production. Mock data is disabled.",
    );
  }

  if (info.providerId === "twelve-data") {
    const { twelveDataApiKey } = getSecretEnv();
    if (!twelveDataApiKey) {
      throw new EnvValidationError(
        "TWELVE_DATA_API_KEY is required for the Twelve Data provider.",
      );
    }
    return new TwelveDataProvider(twelveDataApiKey);
  }

  return new MockMarketDataProvider();
}

export function tryCreateMarketDataProvider(): MarketDataProvider | null {
  try {
    return createMarketDataProvider();
  } catch {
    return null;
  }
}
