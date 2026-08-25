import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import {
  getJournalEntry,
  httpStatusForJournalError,
  patchJournalEntry,
  removeJournalEntry,
} from "@/services/journal";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  const { id } = await context.params;
  const result = await getJournalEntry({ userId: user.id, entryId: id });
  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code },
      { status: httpStatusForJournalError(result.code) },
    );
  }

  return Response.json({ entry: result.data });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const result = await patchJournalEntry({
    userId: user.id,
    entryId: id,
    body,
  });
  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code },
      { status: httpStatusForJournalError(result.code) },
    );
  }

  return Response.json({ entry: result.data });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  const { id } = await context.params;
  const result = await removeJournalEntry({ userId: user.id, entryId: id });
  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code },
      { status: httpStatusForJournalError(result.code) },
    );
  }

  return new Response(null, { status: 204 });
}
