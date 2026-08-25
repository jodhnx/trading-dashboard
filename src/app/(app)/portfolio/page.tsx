import { PortfolioWorkspace } from "@/components/portfolio/portfolio-workspace";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { getAuthUser } from "@/lib/auth/session";
import { getPortfolioSnapshot } from "@/services/portfolio";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const user = await getAuthUser();
  if (!user) {
    return (
      <ErrorState
        title="UNAUTHORIZED"
        description="Sign in to view your portfolio."
      />
    );
  }

  const result = await getPortfolioSnapshot({
    userId: user.id,
    email: user.email ?? null,
  });

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Portfolio</h2>
        <ErrorState
          title="Unable to load portfolio."
          description={result.error}
        />
        <LoadingState label="Portfolio skeleton" />
      </div>
    );
  }

  return <PortfolioWorkspace initial={result.portfolio} />;
}
