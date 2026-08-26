import "server-only";

import { runExitMonitor } from "./run-monitor";

/** @deprecated Prefer runExitMonitor — kept for call-site compatibility. */
export async function loadUserExitCandidates(userId: string) {
  const result = await runExitMonitor({ userId });
  return result.exits;
}
