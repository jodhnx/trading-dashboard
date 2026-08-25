import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import { createResearchService } from "@/services/research/create-service";
import { parseResearchQuery } from "@/services/research/query";
import { serializeResearchItem } from "@/services/research/serialize";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  const parsed = parseResearchQuery({
    asset: request.nextUrl.searchParams.get("asset"),
    category: request.nextUrl.searchParams.get("category"),
    relevance: request.nextUrl.searchParams.get("relevance"),
    limit: request.nextUrl.searchParams.get("limit"),
  });
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.error, code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const items = await createResearchService().list({
    asset: parsed.asset,
    category: parsed.category,
    relevance: parsed.relevance,
    limit: parsed.limit,
  });

  return Response.json({
    items: items.map((item) => serializeResearchItem(item)),
  });
}
