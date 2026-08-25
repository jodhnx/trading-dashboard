import { loadDashboard } from "@/services/dashboard/load";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";

export const dynamic = "force-dynamic";

/**
 * Personal trading workspace.
 * Stored Daily Brief only — never generates or calls external providers on load.
 */
export default async function DashboardPage() {
  const result = await loadDashboard();
  return <DashboardWorkspace result={result} />;
}
