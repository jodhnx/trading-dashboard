import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import {
  getPortfolioSnapshot,
  httpStatusForPortfolioError,
  setPortfolioCash,
} from "@/services/portfolio";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  const result = await getPortfolioSnapshot({
    userId: user.id,
    email: user.email ?? null,
  });

  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code },
      { status: httpStatusForPortfolioError(result.code) },
    );
  }

  return Response.json({ portfolio: result.portfolio });
}

export async function PATCH(request: NextRequest) {
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

  const result = await setPortfolioCash({
    userId: user.id,
    email: user.email ?? null,
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
