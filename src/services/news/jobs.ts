import "server-only";

import { createNewsService } from "./create-service";

/**
 * Scheduled ingest entry point. Call from a later cron job.
 * Do not invoke from dashboard or /news page renders.
 */
export async function fetchLatestNews() {
  return createNewsService().fetchLatestNews();
}
