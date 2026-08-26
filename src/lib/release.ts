/**
 * Single source of truth for release identity.
 * Health, diagnostics, and UI must import from here — never hardcode phase numbers.
 */
export const RELEASE_PHASE = 24 as const;
export const APP_VERSION = "0.24.0" as const;
export const RELEASE_NAME = "FINAL_TRADING_WORKFLOW" as const;

export const RELEASE_NOTES =
  "Phase 24 — final trading workflow: discover → verify → paper enter → monitor → exit. Actionable ELIGIBLE setups only.";
