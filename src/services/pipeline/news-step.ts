import "server-only";

import { fetchLatestNews } from "@/services/news/jobs";

export type NewsStepResult = {
  fetched: boolean;
  inserted: number;
  duplicates: number;
  error?: string;
};

export async function ingestLatestNews(): Promise<NewsStepResult> {
  try {
    const result = await fetchLatestNews();
    return {
      fetched: true,
      inserted: result.stored,
      duplicates: result.duplicates,
    };
  } catch (error) {
    return {
      fetched: false,
      inserted: 0,
      duplicates: 0,
      error: error instanceof Error ? error.message : "news_unavailable",
    };
  }
}
