import { Suspense } from "react";
import { AnalyticsWorkspace } from "@/components/analytics/analytics-workspace";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { getAuthUser } from "@/lib/auth/session";
import { getAnalyticsViewModel } from "@/services/analytics";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const user = await getAuthUser();
  if (!user) {
    return (
      <ErrorState
        title="UNAUTHORIZED"
        description="Sign in to view analytics."
      />
    );
  }

  const result = await getAnalyticsViewModel({
    userId: user.id,
    query: { dataset: "all" },
  });

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Analytics</h2>
        <ErrorState title="Unable to load analytics." description={result.error} />
        <LoadingState label="Analytics skeleton" />
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingState label="Loading analytics" />}>
      <AnalyticsWorkspace initial={result.data} />
    </Suspense>
  );
}
