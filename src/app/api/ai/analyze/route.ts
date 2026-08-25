import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import { parseTechnicalQuery } from "@/services/market/query";
import { symbolSchema } from "@/services/market/schemas";
import { runTradingAnalysis } from "@/services/ai/analyze-service";
import { listOwnAnalyses } from "@/services/ai/persistence";
import { httpStatusForAnalysisError } from "@/services/ai/http";
import { ENGINE_ERROR_CODES } from "@/engine/utils/validation";

const postBodySchema = z.object({
  symbol: z.string().min(1),
  timeframe: z.string().min(1),
});

const limitSchema = z.coerce.number().int().min(1).max(50);

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const body = postBodySchema.safeParse(raw);
  if (!body.success) {
    return Response.json(
      { error: "Invalid request", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const parsed = parseTechnicalQuery({
    symbol: body.data.symbol,
    timeframe: body.data.timeframe,
  });
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.error, code: parsed.code },
      { status: 400 },
    );
  }

  const result = await runTradingAnalysis({
    userId: user.id,
    email: user.email ?? null,
    symbol: parsed.symbol,
    timeframe: parsed.timeframe,
  });

  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code },
      { status: httpStatusForAnalysisError(result.code) },
    );
  }

  return Response.json({ analysis: result.analysis });
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  const symbol = symbolSchema.safeParse(
    request.nextUrl.searchParams.get("symbol") ?? "",
  );
  if (!symbol.success) {
    return Response.json(
      { error: "Invalid symbol", code: ENGINE_ERROR_CODES.INVALID_SYMBOL },
      { status: 400 },
    );
  }

  const limitRaw = request.nextUrl.searchParams.get("limit");
  const limit = limitSchema.safeParse(limitRaw && limitRaw.length > 0 ? limitRaw : 10);
  if (!limit.success) {
    return Response.json(
      { error: "Invalid limit", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const analyses = await listOwnAnalyses({
    userId: user.id,
    symbol: symbol.data,
    limit: limit.data,
  });

  return Response.json({ analyses });
}
