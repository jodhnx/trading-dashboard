import { Suspense } from "react";
import { JournalWorkspace } from "@/components/journal/journal-workspace";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { getAuthUser } from "@/lib/auth/session";
import { getJournalWorkspace } from "@/services/journal";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const user = await getAuthUser();
  if (!user) {
    return (
      <ErrorState
        title="UNAUTHORIZED"
        description="Sign in to view your trading journal."
      />
    );
  }

  const result = await getJournalWorkspace({ userId: user.id });
  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Trading Journal</h2>
        <ErrorState title="Unable to load journal." description={result.error} />
        <LoadingState label="Journal skeleton" />
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingState label="Loading journal" />}>
      <JournalWorkspace initial={result.data} />
    </Suspense>
  );
}
