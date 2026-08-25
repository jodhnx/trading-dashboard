import "server-only";

import { getNewsProviderInfo } from "@/lib/env/public";
import { getSecretEnv } from "@/lib/env/server";
import { EnvValidationError } from "@/lib/env/errors";
import { MockNewsProvider } from "./mock-provider";
import { NewsApiProvider } from "./newsapi-provider";
import type { NewsProvider } from "./provider";

export function createNewsProvider(): NewsProvider {
  const info = getNewsProviderInfo();

  if (info.providerId === "unavailable") {
    throw new EnvValidationError(
      "NEWS_API_KEY is required in production. Mock news is disabled.",
    );
  }

  if (info.providerId === "newsapi") {
    const { newsApiKey } = getSecretEnv();
    if (!newsApiKey) {
      throw new EnvValidationError(
        "NEWS_API_KEY is required for the NewsAPI provider.",
      );
    }
    return new NewsApiProvider(newsApiKey);
  }

  return new MockNewsProvider();
}

export function tryCreateNewsProvider(): NewsProvider | null {
  try {
    return createNewsProvider();
  } catch {
    return null;
  }
}
