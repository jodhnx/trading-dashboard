import { verifyCronAuthorization } from "@/services/pipeline/auth";
import { runDailyPipeline } from "@/services/pipeline/run-daily";

/**
 * Daily production pipeline — scheduled at 05:30 UTC via vercel.json.
 * Vercel Cron sends Authorization: Bearer <CRON_SECRET>.
 * Local testing: POST with the same header (never expose CRON_SECRET to the client).
 */
export async function POST(request: Request) {
  if (!verifyCronAuthorization(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDailyPipeline();
  const statusCode =
    result.status === "FAILED" ? 500 : result.status === "SKIPPED" ? 409 : 200;

  return Response.json({ ok: result.status !== "FAILED", ...result }, { status: statusCode });
}

export async function GET(request: Request) {
  return POST(request);
}
