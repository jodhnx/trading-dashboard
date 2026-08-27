/**
 * Single source of truth for release identity.
 * Health, diagnostics, and UI must import from here — never hardcode phase numbers.
 */
export const RELEASE_PHASE = 27 as const;
export const APP_VERSION = "0.27.0" as const;
export const RELEASE_NAME = "BACKEND_DATA_INTELLIGENCE" as const;

export const RELEASE_NOTES =
  "Phase 27 — scalable AI-powered market research engine: 500+ symbol catalog, multi-stage scanner, news intelligence, structured AI research, sector exposure warnings, and freshness timestamps.";
