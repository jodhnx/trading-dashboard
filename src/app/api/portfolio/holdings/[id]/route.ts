import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import {
  httpStatusForPortfolioError,
  patchHolding,
  removeHolding,
} from "@/services/portfolio";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return Response.json(
      { error: "Holding id is required.", code: "INVALID_INPUT" },
      { status: 400 },
    );
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

  const result = await patchHolding({
    userId: user.id,
    email: user.email ?? null,
    holdingId: id,
    body,
  });

  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code },
      { status: httpStatusForPortfolioError(result.code) },
    );
  }

  return Response.json({ portfolio: result.portfolio });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return Response.json(
      { error: "Holding id is required.", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const result = await removeHolding({
    userId: user.id,
    email: user.email ?? null,
    holdingId: id,
  });

  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code },
      { status: httpStatusForPortfolioError(result.code) },
    );
  }

  return Response.json({ portfolio: result.portfolio });
}
