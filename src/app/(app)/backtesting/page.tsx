import { Suspense } from "react";
import { BacktestingWorkspace } from "@/components/backtest/backtesting-workspace";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { getAuthUser } from "@/lib/auth/session";
import { getBacktestWorkspace } from "@/services/backtest";

export const dynamic = "force-dynamic";

export default async function BacktestingPage() {
  const user = await getAuthUser();
  if (!user) {
    return (
      <ErrorState
        title="UNAUTHORIZED"
        description="Sign in to run historical backtests."
      />
    );
  }

  const result = await getBacktestWorkspace({
    userId: user.id,
    email: user.email ?? null,
  });
  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Backtesting</h2>
        <ErrorState title="Unable to load backtesting." description={result.error} />
        <LoadingState label="Backtesting skeleton" />
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingState label="Loading backtesting" />}>
      <BacktestingWorkspace initial={result.data} />
    </Suspense>
  );
}
