"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatTimestamp } from "@/services/opportunity/ui-utils";

type Summary = {
  assetsInCatalog?: number;
  assetsEvaluated?: number;
  actionableTrades?: number;
  developing?: number;
  speculative?: number;
  watch?: number;
  blocked?: number;
  discovered?: number;
  dataSkipped?: number;
  marketRegime?: string;
  lastMarketUpdate?: string | null;
  lastNewsUpdate?: string | null;
  lastAiUpdate?: string | null;
  freshness?: {
    live?: number;
    recent?: number;
    cached?: number;
    stale?: number;
    unavailable?: number;
  };
};

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface/50 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-[10px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function MarketIntelligenceHeader({
  summary,
  marketRegime,
  scanTimestamp,
  lastMarketUpdate,
  lastNewsUpdate,
  boardState,
}: {
  summary: Summary;
  marketRegime: string;
  scanTimestamp: string | null;
  lastMarketUpdate?: string | null;
  lastNewsUpdate?: string | null;
  boardState: string;
}) {
  const marketTs = lastMarketUpdate ?? scanTimestamp;

  return (
    <Card className="space-y-4 border-accent/20 bg-gradient-to-br from-surface/80 to-surface/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
            Today&apos;s market intelligence
          </p>
          <h2 className="text-lg font-semibold tracking-tight">
            Stored scan summary — not live streaming
          </h2>
          <p className="max-w-3xl text-xs text-muted">
            All figures below come from the latest persisted daily scan. Timestamps
            reflect actual stored update times, not fabricated real-time feeds.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">{marketRegime.replace(/_/g, " ")}</Badge>
          <Badge tone="neutral">{boardState.replace(/_/g, " ")}</Badge>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Metric label="Market regime" value={marketRegime.replace(/_/g, " ")} />
        <Metric
          label="Last market update"
          value={formatTimestamp(marketTs)}
          hint="Technical / price snapshot time"
        />
        <Metric
          label="Last news update"
          value={formatTimestamp(lastNewsUpdate ?? null)}
          hint="Configured news sources only"
        />
        <Metric
          label="Assets scanned"
          value={summary.assetsEvaluated ?? 0}
          hint={`${summary.assetsInCatalog ?? 0} in catalog`}
        />
        <Metric label="Actionable setups" value={summary.actionableTrades ?? 0} />
        <Metric label="Developing setups" value={summary.developing ?? 0} />
        <Metric label="Speculative" value={summary.speculative ?? 0} />
        <Metric label="Data skipped" value={summary.dataSkipped ?? 0} />
        <Metric label="Watch" value={summary.watch ?? 0} />
        <Metric label="Blocked" value={summary.blocked ?? 0} />
        <Metric label="Discovered" value={summary.discovered ?? 0} />
        <Metric
          label="Fresh rows"
          value={
            (summary.freshness?.live ?? 0) +
            (summary.freshness?.recent ?? 0) +
            (summary.freshness?.cached ?? 0)
          }
          hint={`${summary.freshness?.stale ?? 0} stale · ${summary.freshness?.unavailable ?? 0} unavailable`}
        />
      </div>
    </Card>
  );
}
