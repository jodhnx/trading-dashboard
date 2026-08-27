"use client";

import type { OpportunityCandidate } from "@/services/opportunity/present";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type Summary = {
  assetsInCatalog?: number;
  assetsEvaluated?: number;
  stocksAnalyzed?: number;
  cryptoAnalyzed?: number;
  etfAnalyzed?: number;
  actionableTrades?: number;
  developing?: number;
  speculative?: number;
  watch?: number;
  blocked?: number;
  discovered?: number;
  dataSkipped?: number;
  highNewsImpact?: number;
  marketRegime?: string;
  freshness?: {
    live?: number;
    recent?: number;
    cached?: number;
    stale?: number;
    unavailable?: number;
  };
};

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border/60 bg-surface/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold">{value}</p>
    </div>
  );
}

export function DailySummaryBar({
  summary,
  marketRegime,
  scanTimestamp,
}: {
  summary: Summary;
  marketRegime: string;
  scanTimestamp: string | null;
}) {
  const fresh = summary.freshness;
  const freshTotal =
    (fresh?.live ?? 0) + (fresh?.recent ?? 0) + (fresh?.cached ?? 0);

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Daily market summary</h2>
          <p className="text-[11px] text-muted">
            Stored scan only — {summary.assetsEvaluated ?? 0} assets evaluated from{" "}
            {summary.assetsInCatalog ?? 0} in catalog
            {scanTimestamp
              ? ` · last scan ${new Date(scanTimestamp).toLocaleString()}`
              : ""}
          </p>
        </div>
        <Badge tone="neutral">{marketRegime}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-8">
        <Metric label="Actionable" value={summary.actionableTrades ?? 0} />
        <Metric label="Developing" value={summary.developing ?? 0} />
        <Metric label="Speculative" value={summary.speculative ?? 0} />
        <Metric label="Watch" value={summary.watch ?? 0} />
        <Metric label="Blocked" value={summary.blocked ?? 0} />
        <Metric label="Data skipped" value={summary.dataSkipped ?? 0} />
        <Metric label="Stocks" value={summary.stocksAnalyzed ?? 0} />
        <Metric label="Crypto" value={summary.cryptoAnalyzed ?? 0} />
        <Metric label="ETFs" value={summary.etfAnalyzed ?? 0} />
        <Metric label="Discovered" value={summary.discovered ?? 0} />
        <Metric label="High news impact" value={summary.highNewsImpact ?? 0} />
        <Metric label="Fresh data rows" value={freshTotal} />
      </div>
    </Card>
  );
}

export function ActionableSetupsSection({
  trades,
}: {
  trades: OpportunityCandidate[];
}) {
  if (trades.length === 0) {
    return (
      <Card className="space-y-2">
        <h2 className="text-sm font-semibold">Today&apos;s actionable setups</h2>
        <p className="text-sm font-semibold">NO CONFIRMED SETUP TODAY</p>
        <p className="text-xs text-muted">
          No candidate currently meets CONFIRMED/STRONG + ELIGIBLE with valid entry,
          stop, TP1, TP2 and risk/reward. This is a correct result — do not force a trade.
        </p>
      </Card>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Today&apos;s actionable setups</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {trades.map((item) => (
          <Card key={item.symbol} className="space-y-2 border-positive/30">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-lg font-semibold">{item.symbol}</span>
              <Badge tone={item.direction === "LONG" ? "positive" : "negative"}>
                {item.direction}
              </Badge>
              <Badge tone="positive">{item.boardQualityLabel ?? "TRADE"}</Badge>
              <Badge tone="neutral">{item.riskLevel}</Badge>
            </div>
            <p className="text-sm font-semibold text-accent">{item.actionLabel}</p>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div>
                <p className="text-muted">Entry zone</p>
                <p className="font-mono">
                  {item.entryZone
                    ? `${item.entryZone.low ?? "—"} – ${item.entryZone.high ?? "—"}`
                    : item.entry ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-muted">Stop / TP1 / TP2</p>
                <p className="font-mono">
                  {item.stop ?? "—"} / {item.tp1 ?? "—"} / {item.tp2 ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-muted">R:R · Risk %</p>
                <p className="font-mono">
                  {item.riskReward?.toFixed(2) ?? "—"} ·{" "}
                  {item.recommendedRiskPercent ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-muted">News</p>
                <p className="line-clamp-2">{item.newsSummary.impactExplanation}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
