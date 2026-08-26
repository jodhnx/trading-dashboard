/**
 * Single source of truth for release identity.
 * Health, diagnostics, and UI must import from here — never hardcode phase numbers.
 */
export const RELEASE_PHASE = 23 as const;
export const APP_VERSION = "0.23.0" as const;
export const RELEASE_NAME = "FINAL_RELEASE_CANDIDATE" as const;

export const RELEASE_NOTES =
  "Phase 23 — production readiness: trade-status clarity, MTF reasons, blocked setups visible, centralized release identity.";
