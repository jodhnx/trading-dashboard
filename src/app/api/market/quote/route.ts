import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import { createMarketDataService } from "@/services/market/create-service";
import { parseQuoteSymbol } from "@/services/market/query";
import { serializeQuoteResult } from "@/services/market/serialize";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  const parsed = parseQuoteSymbol(request.nextUrl.searchParams.get("symbol"));
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.error, code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const result = await createMarketDataService().getQuote(parsed.symbol);
  if (result.status === "UNAVAILABLE" || !result.quote) {
    return Response.json(
      { error: "MARKET DATA UNAVAILABLE", code: "DATA_UNAVAILABLE", result: serializeQuoteResult(result) },
      { status: 503 },
    );
  }

  return Response.json({ result: serializeQuoteResult(result) });
}
