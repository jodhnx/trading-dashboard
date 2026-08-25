import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import {
  getAnalyticsViewModel,
  httpStatusForAnalyticsError,
} from "@/services/analytics";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const result = await getAnalyticsViewModel({
    userId: user.id,
    query: {
      preset: params.get("preset") ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      symbol: params.get("symbol") ?? undefined,
      dataset: params.get("dataset") ?? undefined,
    },
  });

  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code },
      { status: httpStatusForAnalyticsError(result.code) },
    );
  }

  return Response.json(result.data);
}
