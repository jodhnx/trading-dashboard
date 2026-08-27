/**
 * Single source of truth for release identity.
 * Health, diagnostics, and UI must import from here — never hardcode phase numbers.
 */
export const RELEASE_PHASE = 26 as const;
export const APP_VERSION = "0.26.0" as const;
export const RELEASE_NAME = "DAILY_MARKET_SCREENER" as const;

export const RELEASE_NOTES =
  "Phase 26 — daily market intelligence screener: opportunity table, news impact, filters, and actionable setup view.";
