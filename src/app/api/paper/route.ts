import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import {
  getPaperAccountSnapshot,
  httpStatusForPaperError,
} from "@/services/paper";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  const result = await getPaperAccountSnapshot({ userId: user.id });
  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code },
      { status: httpStatusForPaperError(result.code) },
    );
  }

  return Response.json({ account: result.account });
}
