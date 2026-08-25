import "server-only";

import { getNewsProviderInfo } from "@/lib/env/public";
import { getSecretEnv } from "@/lib/env/server";
import { EnvValidationError } from "@/lib/env/errors";
import { summarizeNews } from "@/ai/news/summarize";
import { MemoryCache } from "@/services/market/cache";
import { ResearchService } from "@/services/research/research-service";
import { supabaseResearchPersistence } from "@/services/research/persistence";
import { newsListCache } from "./cache";
import { tryCreateNewsProvider } from "./factory";
import { NewsService } from "./news-service";
import { supabaseNewsPersistence } from "./persistence";
import type { StoredNews } from "./types";

function allowMockNews(): boolean {
  try {
    return getNewsProviderInfo().isMock;
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return false;
    }
    throw error;
  }
}

export function createNewsService(): NewsService {
  const { openaiApiKey } = getSecretEnv();
  const research = new ResearchService(supabaseResearchPersistence);
  return new NewsService(
    tryCreateNewsProvider(),
    newsListCache as MemoryCache<StoredNews[]>,
    supabaseNewsPersistence,
    research,
    openaiApiKey
      ? (item) => summarizeNews(item, { apiKey: openaiApiKey })
      : null,
    allowMockNews(),
  );
}
