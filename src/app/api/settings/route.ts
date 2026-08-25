import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import {
  settingsInputSchema,
  toSettingsRecord,
} from "@/lib/settings/schema";
import {
  getOrCreateAccountSettings,
  updateAccountSettings,
} from "@/lib/settings/service";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  try {
    const settings = await getOrCreateAccountSettings(user.id, user.email ?? null);
    return Response.json({ settings });
  } catch {
    return Response.json(
      { error: "DATA UNAVAILABLE", code: "DATA_UNAVAILABLE" },
      { status: 503 },
    );
  }
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

  const parsed = settingsInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid settings.",
        code: "INVALID_INPUT",
      },
      { status: 400 },
    );
  }

  try {
    await updateAccountSettings(user.id, toSettingsRecord(parsed.data));
    const settings = await getOrCreateAccountSettings(user.id, user.email ?? null);
    return Response.json({ settings });
  } catch {
    return Response.json(
      { error: "Could not save settings.", code: "SAVE_FAILED" },
      { status: 500 },
    );
  }
}
