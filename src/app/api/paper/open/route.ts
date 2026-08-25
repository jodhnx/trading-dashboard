import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import {
  httpStatusForPaperError,
  openPaperTrade,
} from "@/services/paper";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const result = await openPaperTrade({
    userId: user.id,
    email: user.email ?? null,
    body,
  });

  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code },
      { status: httpStatusForPaperError(result.code) },
    );
  }

  return Response.json({ account: result.account }, { status: 201 });
}
