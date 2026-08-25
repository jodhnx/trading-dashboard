import { Card } from "@/components/ui/card";
import type { DashboardViewModel } from "@/services/dashboard/view-model";

export function DailyDecisionCard({ model }: { model: DashboardViewModel }) {
  const tone =
    model.decisionStatus === "OPPORTUNITY"
      ? "border-positive/40 bg-positive/10"
      : model.decisionStatus === "WATCHLIST"
        ? "border-accent/40 bg-accent/10"
        : "border-warning/40 bg-warning/10";

  return (
    <Card className={`space-y-2 ${tone}`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
        Primary daily decision
      </p>
      <p className="text-3xl font-semibold tracking-tight md:text-4xl">
        {model.decisionTitle}
      </p>
      <p className="max-w-2xl text-sm text-foreground/90">{model.decisionDetail}</p>
      {model.summary ? (
        <p className="text-xs text-muted">{model.summary}</p>
      ) : null}
    </Card>
  );
}
