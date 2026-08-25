import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import {
  findBriefByDate,
  listBriefHistory,
  parseBriefDateParam,
} from "@/services/daily-brief";

const limitSchema = z.coerce.number().int().min(1).max(60);

/**
 * GET /api/daily-brief
 * GET /api/daily-brief?date=YYYY-MM-DD
 * GET /api/daily-brief?history=1&limit=14
 *
 * Reads persisted briefs only. Does not call OpenAI or market providers.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  const historyFlag = request.nextUrl.searchParams.get("history");
  if (historyFlag === "1" || historyFlag === "true") {
    const limit = limitSchema.safeParse(
      request.nextUrl.searchParams.get("limit") ?? "14",
    );
    if (!limit.success) {
      return Response.json(
        { error: "Invalid limit", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }
    const briefs = await listBriefHistory({
      userId: user.id,
      limit: limit.data,
    });
    return Response.json({ briefs });
  }

  const parsed = parseBriefDateParam(
    request.nextUrl.searchParams.get("date"),
  );
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.error, code: "INVALID_DATE" },
      { status: 400 },
    );
  }

  const brief = await findBriefByDate({
    userId: user.id,
    briefDate: parsed.date,
  });

  if (!brief) {
    return Response.json(
      {
        brief: null,
        date: parsed.date,
        code: "BRIEF_NOT_FOUND",
        error: `No Daily Brief stored for ${parsed.date}`,
      },
      { status: 404 },
    );
  }

  return Response.json({ brief });
}
