import "server-only";

import { scanDailyOpportunities } from "@/services/opportunity/scan";
import { persistOpportunityScan } from "@/services/opportunity/persistence";
import type { OpportunityScanSummary } from "@/services/opportunity/types";

export async function runOpportunityScanForUser(input: {
  userId: string;
  email: string | null;
  briefDate: string;
  now?: Date;
}): Promise<{
  summary: OpportunityScanSummary;
  persisted: { inserted: number; skipped: number };
}> {
  const summary = await scanDailyOpportunities({
    userId: input.userId,
    email: input.email,
    now: input.now,
    persistence: "admin",
  });

  const persistable = [
    ...summary.topStocks,
    ...summary.topCrypto,
    ...summary.all.filter((item) => item.tier === "WATCH").slice(0, 15),
  ];
  const seen = new Set<string>();
  const unique = persistable.filter((item) => {
    if (seen.has(item.symbol)) return false;
    seen.add(item.symbol);
    return true;
  });

  const persisted = await persistOpportunityScan({
    userId: input.userId,
    briefDate: input.briefDate,
    opportunities: unique,
    persistence: "admin",
  });

  return { summary, persisted };
}
