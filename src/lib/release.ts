/**
 * Single source of truth for release identity.
 * Health, diagnostics, and UI must import from here — never hardcode phase numbers.
 */
export const RELEASE_PHASE = 28 as const;
export const APP_VERSION = "0.28.0" as const;
export const RELEASE_NAME = "MARKET_RESEARCH_TERMINAL" as const;

export const RELEASE_NOTES =
  "Phase 28 — professional AI market research terminal: intelligence header, top candidates, full opportunity table, detail panel, position planner, sector warnings, and production readiness audit.";
