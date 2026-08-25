import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedPayload } from "@/lib/auth/routes";
import { createNewsService } from "@/services/news/create-service";

export async function POST() {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(unauthorizedPayload(), { status: 401 });
  }

  try {
    const result = await createNewsService().fetchLatestNews();
    return Response.json({ result });
  } catch {
    return Response.json(
      { error: "NEWS UNAVAILABLE", code: "NEWS_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
