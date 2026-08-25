import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import { createMarketDataService } from "@/services/market/create-service";
import { parseHistoryQuery } from "@/services/market/query";
import { serializeCandleResult } from "@/services/market/serialize";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  const parsed = parseHistoryQuery({
    symbol: request.nextUrl.searchParams.get("symbol"),
    timeframe: request.nextUrl.searchParams.get("timeframe"),
    limit: request.nextUrl.searchParams.get("limit"),
  });

  if (!parsed.ok) {
    return Response.json(
      { error: parsed.error, code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const result = await createMarketDataService().getCandles(
    parsed.symbol,
    parsed.timeframe,
    parsed.limit,
  );

  if (result.status === "UNAVAILABLE" || result.candles.length === 0) {
    return Response.json(
      {
        error: "MARKET DATA UNAVAILABLE",
        code: "DATA_UNAVAILABLE",
        result: serializeCandleResult(result),
      },
      { status: 503 },
    );
  }

  return Response.json({ result: serializeCandleResult(result) });
}
