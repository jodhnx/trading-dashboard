import { Card } from "@/components/ui/card";
import type { DashboardViewModel } from "@/services/dashboard/view-model";

function formatStamp(value: string): string {
  if (value === "UNKNOWN" || value.startsWith("AI_")) {
    return value;
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return value;
  return new Date(ms).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DataFreshness({ model }: { model: DashboardViewModel }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
        Last updated
      </h3>
      <Card className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stamp label="Brief generated" value={formatStamp(model.freshness.briefGenerated)} />
        <Stamp label="Market data" value={formatStamp(model.freshness.marketData)} />
        <Stamp label="News" value={formatStamp(model.freshness.news)} />
        <Stamp label="AI" value={formatStamp(model.freshness.ai)} />
      </Card>
    </section>
  );
}

function Stamp({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono text-xs">{value}</p>
    </div>
  );
}
