/** In-memory list cache. Pages read this / Supabase; they do not hit the news provider. */
export const NEWS_CACHE_TTL_MS = 5 * 60_000;

/** Published age after which the UI must show STALE. Items are not deleted. */
export const NEWS_STALE_AFTER_MS = 24 * 60 * 60_000;

export const NEWS_PROVIDER_TIMEOUT_MS = 10_000;
export const DEFAULT_NEWS_LIMIT = 20;
export const MAX_NEWS_LIMIT = 100;
export const MAX_INGEST_AI_SUMMARIES = 3;
