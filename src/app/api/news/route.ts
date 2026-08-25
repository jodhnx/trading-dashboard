import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import { createNewsService } from "@/services/news/create-service";
import { parseNewsQuery } from "@/services/news/query";
import { serializeNewsItem } from "@/services/news/serialize";
import { NewsUnavailableError } from "@/services/news/errors";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  const parsed = parseNewsQuery({
    asset: request.nextUrl.searchParams.get("asset"),
    category: request.nextUrl.searchParams.get("category"),
    limit: request.nextUrl.searchParams.get("limit"),
    from: request.nextUrl.searchParams.get("from"),
    to: request.nextUrl.searchParams.get("to"),
  });
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.error, code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  try {
    const result = await createNewsService().listNews({
      asset: parsed.asset,
      category: parsed.category,
      limit: parsed.limit,
      from: parsed.from,
      to: parsed.to,
    });
    if (result.status === "UNAVAILABLE" && result.items.length === 0) {
      return Response.json(
        { error: "NEWS UNAVAILABLE", code: "NEWS_UNAVAILABLE", items: [] },
        { status: 503 },
      );
    }
    return Response.json({
      status: result.status,
      source: result.source,
      items: result.items.map((item) => serializeNewsItem(item)),
    });
  } catch (error) {
    if (error instanceof NewsUnavailableError) {
      return Response.json(
        { error: "NEWS UNAVAILABLE", code: "NEWS_UNAVAILABLE" },
        { status: 503 },
      );
    }
    throw error;
  }
}
