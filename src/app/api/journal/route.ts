import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import {
  createManualJournalEntry,
  getJournalWorkspace,
  httpStatusForJournalError,
} from "@/services/journal";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const result = await getJournalWorkspace({
    userId: user.id,
    query: {
      symbol: params.get("symbol") ?? undefined,
      side: params.get("side") ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      tag: params.get("tag") ?? undefined,
      limit: params.get("limit") ?? undefined,
    },
  });

  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code },
      { status: httpStatusForJournalError(result.code) },
    );
  }

  return Response.json(result.data);
}

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

  const result = await createManualJournalEntry({
    userId: user.id,
    body,
  });

  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code },
      { status: httpStatusForJournalError(result.code) },
    );
  }

  return Response.json({ entry: result.data }, { status: 201 });
}
