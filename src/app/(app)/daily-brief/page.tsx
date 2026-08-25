import { getAuthUser } from "@/lib/auth/session";
import {
  findBriefByDate,
  listBriefHistory,
  utcBriefDate,
} from "@/services/daily-brief";
import { DailyBriefView } from "@/components/daily-brief/daily-brief-view";
import { ErrorState } from "@/components/states/error-state";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ date?: string | string[] }>;
};

export default async function DailyBriefPage({ searchParams }: PageProps) {
  const user = await getAuthUser();
  if (!user) {
    return (
      <ErrorState
        title="UNAUTHORIZED"
        description="Sign in to view stored Daily Briefs."
      />
    );
  }

  const query = await searchParams;
  const rawDate = Array.isArray(query.date) ? query.date[0] : query.date;
  const briefDate = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? rawDate
    : utcBriefDate();

  let brief = null;
  let history: Awaited<ReturnType<typeof listBriefHistory>> = [];
  try {
    brief = await findBriefByDate({
      userId: user.id,
      briefDate,
    });
    history = await listBriefHistory({
      userId: user.id,
      limit: 14,
    });
  } catch {
    return (
      <ErrorState
        title="DATA UNAVAILABLE"
        description="Could not load stored Daily Briefs."
      />
    );
  }

  return <DailyBriefView brief={brief} history={history} />;
}
