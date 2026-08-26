/**
 * Single source of truth for release identity.
 * Health, diagnostics, and UI must import from here — never hardcode phase numbers.
 */
export const RELEASE_PHASE = 25 as const;
export const APP_VERSION = "0.25.0" as const;
export const RELEASE_NAME = "BROAD_MARKET_SCANNER" as const;

export const RELEASE_NOTES =
  "Phase 25 — broad market opportunity scanner: two-stage scan, risk engine, discovery ranking, expanded universe.";
