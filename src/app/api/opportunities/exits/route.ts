import { getAuthUser } from "@/lib/auth/session";
import { loadUserExitCandidates } from "@/services/exit/load-user-exits";
import { SCHEDULER_NOTE } from "@/services/opportunity/types";

/**
 * Exit / thesis monitoring for open paper positions.
 * Uses current market quotes when available — never fabricates prices.
 * Note: Vercel Hobby daily cron is not real-time exit monitoring.
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const exits = await loadUserExitCandidates(user.id);

  return Response.json({
    ok: true,
    exits,
    count: exits.length,
    urgent: exits.filter((e) => e.exitUrgency === "URGENT_EXIT"),
    takeProfit: exits.filter((e) => e.exitUrgency === "TAKE_PROFIT"),
    schedulerNote: SCHEDULER_NOTE,
    disclaimer:
      "Exit states are informational. Prices come from the market provider when LIVE/CACHED; missing quotes are omitted, never invented.",
  });
}
