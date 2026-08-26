/**
 * Phase 25 — callable scanner boundary for cron / external scheduler.
 * Re-exports scanDailyOpportunities as runOpportunityScanner.
 */
export { scanDailyOpportunities as runOpportunityScanner } from "./scan";
