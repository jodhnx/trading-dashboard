import "server-only";

import { createOpenAiClient } from "@/ai/create-client";
import { scanDailyOpportunities } from "@/services/opportunity/scan";
import { runAiResearchForCandidates } from "@/services/opportunity/ai-research";
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
  let summary = await scanDailyOpportunities({
    userId: input.userId,
    email: input.email,
    now: input.now,
    persistence: "admin",
  });

  const client = createOpenAiClient();
  const researched = await runAiResearchForCandidates({
    candidates: summary.all,
    client,
    now: input.now,
    limit: 12,
  });

  if (researched.completed > 0) {
    summary = {
      ...summary,
      all: researched.updated,
    };
  }

  const persistable = [
    ...summary.all.filter(
      (item) =>
        item.quality !== "DATA_INSUFFICIENT" &&
        (item.tier === "STRONG_OPPORTUNITY" ||
          item.tier === "OPPORTUNITY" ||
          item.tier === "WATCH" ||
          item.tradeStatus === "BLOCKED"),
    ),
  ].slice(0, 250);

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
