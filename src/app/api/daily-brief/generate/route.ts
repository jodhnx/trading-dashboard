import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import { generateDailyBrief } from "@/services/daily-brief/generate";
import { httpStatusForBriefError } from "@/services/daily-brief/http";

const bodySchema = z.object({
  date: z.string().optional().nullable(),
});

/**
 * POST /api/daily-brief/generate
 * Explicit generation only. Auth required. Duplicate date → 409.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  let raw: unknown = {};
  const text = await request.text();
  if (text.trim().length > 0) {
    try {
      raw = JSON.parse(text);
    } catch {
      return Response.json(
        { error: "Invalid JSON", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }
  }

  const body = bodySchema.safeParse(raw);
  if (!body.success) {
    return Response.json(
      { error: "Invalid request", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const result = await generateDailyBrief({
    userId: user.id,
    email: user.email ?? null,
    date: body.data.date,
  });

  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code },
      { status: httpStatusForBriefError(result.code) },
    );
  }

  return Response.json({ brief: result.brief });
}
