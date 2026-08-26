import { getAuthUser } from "@/lib/auth/session";
import { runExitMonitor } from "@/services/exit/run-monitor";

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

  const result = await runExitMonitor({ userId: user.id });

  return Response.json({
    ...result,
    disclaimer:
      "Exit states are informational / PAPER. Prices come from the market provider when LIVE/CACHED; missing quotes are omitted, never invented. Daily cron is not intraday real-time.",
  });
}
