import { NextRequest } from "next/server";
import { diagnoseAuth } from "@/lib/auth/debug";

function denyProduction() {
  return Response.json({ error: "Not found" }, { status: 404 });
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return denyProduction();
  }
  const report = await diagnoseAuth();
  return Response.json(report);
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return denyProduction();
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
  } | null;

  const report = await diagnoseAuth({
    email: typeof body?.email === "string" ? body.email : undefined,
    password: typeof body?.password === "string" ? body.password : undefined,
  });
  return Response.json(report);
}
