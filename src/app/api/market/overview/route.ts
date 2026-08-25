import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import { createMarketDataService } from "@/services/market/create-service";
import { MARKET_WATCHLIST } from "@/services/market/symbols";
import { serializeQuoteResult } from "@/services/market/serialize";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  const raw = request.nextUrl.searchParams.get("symbols");
  const symbols = raw
    ? raw.split(",").map((item) => item.trim()).filter(Boolean)
    : MARKET_WATCHLIST.map((asset) => asset.symbol);

  const items = await createMarketDataService().getOverview(symbols);
  return Response.json({
    items: items.map(serializeQuoteResult),
  });
}
