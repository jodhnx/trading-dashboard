import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import {
  closePaperPosition,
  httpStatusForPaperError,
} from "@/services/paper";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return Response.json(
      { error: "Position id is required.", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const result = await closePaperPosition({
    userId: user.id,
    positionId: id,
  });

  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code },
      { status: httpStatusForPaperError(result.code) },
    );
  }

  return Response.json({ account: result.account });
}
