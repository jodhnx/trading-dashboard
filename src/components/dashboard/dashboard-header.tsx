import { Badge } from "@/components/ui/badge";
import { DataStatusBadge } from "@/components/market/data-status-badge";
import type { DashboardViewModel } from "@/services/dashboard/view-model";
import { DATA_STATUSES, type DataStatus } from "@/services/market/provider";

function asDataStatus(value: string): DataStatus {
  return (DATA_STATUSES as readonly string[]).includes(value)
    ? (value as DataStatus)
    : "UNAVAILABLE";
}

function decisionTone(
  status: DashboardViewModel["decisionStatus"],
): "positive" | "accent" | "warning" {
  if (status === "OPPORTUNITY") return "positive";
  if (status === "WATCHLIST") return "accent";
  return "warning";
}

function formatDate(briefDate: string): string {
  const ms = Date.parse(`${briefDate}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) return briefDate;
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatGenerated(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "UNKNOWN";
  return new Date(ms).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DashboardHeader({ model }: { model: DashboardViewModel }) {
  return (
    <header className="space-y-3 border-b border-border pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Today
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
            {formatDate(model.briefDate)}
            <span className="ml-2 text-sm font-normal text-muted">UTC</span>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={decisionTone(model.decisionStatus)}>
            {model.decisionStatus === "NO_TRADE"
              ? "NO TRADE"
              : model.decisionStatus}
          </Badge>
          <DataStatusBadge status={asDataStatus(model.dataStatus)} />
          {model.isStale ? <Badge tone="warning">STALE DATA</Badge> : null}
          {model.isMock ? <Badge tone="warning">MOCK</Badge> : null}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Meta label="Market regime" value={model.marketRegime} />
        <Meta label="Risk environment" value={model.riskEnvironment} />
        <Meta label="Data status" value={model.dataStatus} />
        <Meta label="Brief generated" value={formatGenerated(model.generatedAt)} />
      </div>
      <p className="text-xs text-muted">
        Research desk view from the stored Daily Brief — not a guaranteed prediction
        and not an executed order.
      </p>
    </header>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono text-sm font-medium">{value}</p>
    </div>
  );
}
