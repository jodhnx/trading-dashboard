import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import { createMarketDataService } from "@/services/market/create-service";
import { parseTechnicalQuery } from "@/services/market/query";
import { serializeTradingSetup } from "@/services/market/serialize";
import { getOrCreateAccountSettings } from "@/lib/settings/service";
import { toTradingRiskSettings } from "@/lib/settings/schema";
import { buildTradingSetup } from "@/engine/trading/setup";
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

  let settings;
  try {
    settings = await getOrCreateAccountSettings(user.id, user.email ?? null);
  } catch {
    return Response.json(
      { error: "SETTINGS UNAVAILABLE", code: "DATA_UNAVAILABLE" },
      { status: 503 },
    );
  }

  const technical = await createMarketDataService().getTechnicalSnapshot(
    parsed.symbol,
    parsed.timeframe,
  );

  if (
    technical.snapshot.dataStatus === "UNAVAILABLE" ||
    technical.snapshot.dataError === ENGINE_ERROR_CODES.DATA_UNAVAILABLE
  ) {
    return Response.json(
      {
        error: "MARKET DATA UNAVAILABLE",
        code: ENGINE_ERROR_CODES.DATA_UNAVAILABLE,
        setup: serializeTradingSetup(
          buildTradingSetup({
            snapshot: technical.snapshot,
            settings: toTradingRiskSettings(settings),
          }),
        ),
      },
      { status: 503 },
    );
  }

  const setup = buildTradingSetup({
    snapshot: technical.snapshot,
    settings: toTradingRiskSettings(settings),
  });

  return Response.json({ setup: serializeTradingSetup(setup) });
}
