import { PaperTradingWorkspace } from "@/components/paper/paper-trading-workspace";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { getAuthUser } from "@/lib/auth/session";
import { getPaperAccountSnapshot } from "@/services/paper";
import { getJournalLinksForPaperTrades } from "@/services/journal";

export const dynamic = "force-dynamic";

export default async function PositionsPage() {
  const user = await getAuthUser();
  if (!user) {
    return (
      <ErrorState
        title="UNAUTHORIZED"
        description="Sign in to view paper trading positions."
      />
    );
  }

  const [result, journalLinkMap] = await Promise.all([
    getPaperAccountSnapshot({ userId: user.id }),
    getJournalLinksForPaperTrades({ userId: user.id }),
  ]);
  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Paper Trading</h2>
        <ErrorState
          title="Unable to load paper account."
          description={result.error}
        />
        <LoadingState label="Paper account skeleton" />
      </div>
    );
  }

  const journalLinks = Object.fromEntries(journalLinkMap.entries());

  return (
    <PaperTradingWorkspace
      initial={result.account}
      journalLinks={journalLinks}
    />
  );
}
