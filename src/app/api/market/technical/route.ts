import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import { createMarketDataService } from "@/services/market/create-service";
import { parseTechnicalQuery } from "@/services/market/query";
import { serializeTechnicalSnapshot } from "@/services/market/serialize";
import { ENGINE_ERROR_CODES } from "@/engine/utils/validation";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  const parsed = parseTechnicalQuery({
    symbol: request.nextUrl.searchParams.get("symbol"),
    timeframe: request.nextUrl.searchParams.get("timeframe"),
  });

  if (!parsed.ok) {
    return Response.json(
      { error: parsed.error, code: parsed.code },
      { status: 400 },
    );
  }

  const result = await createMarketDataService().getTechnicalSnapshot(
    parsed.symbol,
    parsed.timeframe,
  );

  if (
    result.snapshot.dataStatus === "UNAVAILABLE" ||
    result.snapshot.dataError === ENGINE_ERROR_CODES.DATA_UNAVAILABLE
  ) {
    return Response.json(
      {
        error: "MARKET DATA UNAVAILABLE",
        code: ENGINE_ERROR_CODES.DATA_UNAVAILABLE,
        snapshot: serializeTechnicalSnapshot(result.snapshot),
      },
      { status: 503 },
    );
  }

  return Response.json({
    snapshot: serializeTechnicalSnapshot(result.snapshot),
  });
}
