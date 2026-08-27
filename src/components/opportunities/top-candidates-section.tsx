"use client";

import Link from "next/link";
import type { OpportunityCandidate } from "@/services/opportunity/present";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  formatOpportunityPrice,
  formatRiskPercent,
  freshnessBadgeLabel,
} from "@/services/opportunity/ui-utils";

function toneForDirection(direction: string): "positive" | "negative" | "neutral" {
  if (direction === "LONG") return "positive";
  if (direction === "SHORT") return "negative";
  return "neutral";
}

export function TopCandidateCard({
  title,
  emptyTitle,
  item,
  emptyReason,
  requireActionable = false,
  variant = "default",
}: {
  title: string;
  emptyTitle: string;
  item: OpportunityCandidate | null;
  emptyReason?: string | null;
  requireActionable?: boolean;
  variant?: "default" | "developing" | "highRisk";
}) {
  const show = item && (!requireActionable || item.actionable);

  if (!show) {
    return (
      <Card className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
          {title}
        </p>
        <p className="text-sm font-semibold">{emptyTitle}</p>
        <p className="text-xs text-muted">
          {emptyReason ??
            "No candidate currently meets the required gates on stored scan data."}
        </p>
      </Card>
    );
  }

  const borderClass =
    variant === "highRisk"
      ? "border-warning/40"
      : variant === "developing"
        ? "border-accent/30"
        : "border-positive/30";

  return (
    <Card className={`space-y-3 ${borderClass}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {title}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/market/${encodeURIComponent(item.symbol)}`}
          className="font-mono text-xl font-semibold hover:text-accent"
        >
          {item.symbol}
        </Link>
        <span className="text-xs text-muted">{item.name}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge tone={toneForDirection(item.direction)}>{item.direction}</Badge>
        <Badge tone={item.actionable ? "positive" : "warning"}>
          {item.boardQualityLabel ?? item.quality}
        </Badge>
        <Badge tone="neutral">{item.riskLevel}</Badge>
        <Badge tone="neutral">{freshnessBadgeLabel(item.dataQuality)}</Badge>
      </div>
      <p className="text-sm font-semibold text-accent">{item.aiView.label}</p>
      <p className="text-xs text-muted">{item.aiView.explanation}</p>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <p className="text-muted">Price</p>
          <p className="font-mono">{formatOpportunityPrice(item.price)}</p>
        </div>
        <div>
          <p className="text-muted">Score</p>
          <p className="font-mono">{item.opportunityScore.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-muted">Entry / Stop</p>
          <p className="font-mono">
            {formatOpportunityPrice(item.entry)} / {formatOpportunityPrice(item.stop)}
          </p>
        </div>
        <div>
          <p className="text-muted">TP1 / TP2 / R:R</p>
          <p className="font-mono">
            {formatOpportunityPrice(item.tp1)} / {formatOpportunityPrice(item.tp2)} /{" "}
            {item.riskReward?.toFixed(2) ?? "—"}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted">Risk %</p>
          <p className="font-mono">{formatRiskPercent(item.recommendedRiskPercent)}</p>
        </div>
        <div>
          <p className="text-muted">News impact</p>
          <p>
            {item.newsSummary.impactLabel} · {item.newsSummary.sentimentLabel}
          </p>
        </div>
      </div>
      <div className="rounded-md border border-border/60 bg-surface/40 p-2">
        <p className="text-[10px] font-medium uppercase text-muted">Why ranked</p>
        <p className="mt-1 text-xs">{item.whyRanked}</p>
      </div>
    </Card>
  );
}

export function TopCandidatesSection({
  bestActionableStock,
  bestActionableCrypto,
  highRiskCandidate,
  developingSetup,
  whyNoBestStock,
  whyNoBestCrypto,
}: {
  bestActionableStock: OpportunityCandidate | null;
  bestActionableCrypto: OpportunityCandidate | null;
  highRiskCandidate: OpportunityCandidate | null;
  developingSetup: OpportunityCandidate | null;
  whyNoBestStock?: string | null;
  whyNoBestCrypto?: string | null;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Today&apos;s top candidates</h2>
        <p className="text-[11px] text-muted">
          Actionable cards require ELIGIBLE + valid levels. Watch and developing
          candidates are shown separately and never promoted to actionable.
        </p>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <TopCandidateCard
          title="Best actionable stock"
          emptyTitle="NO CONFIRMED STOCK SETUP TODAY"
          item={bestActionableStock}
          emptyReason={whyNoBestStock}
          requireActionable
        />
        <TopCandidateCard
          title="Best actionable crypto"
          emptyTitle="NO CONFIRMED CRYPTO SETUP TODAY"
          item={bestActionableCrypto}
          emptyReason={whyNoBestCrypto}
          requireActionable
        />
        <TopCandidateCard
          title="High-risk candidate"
          emptyTitle="NO HIGH-RISK CANDIDATE TODAY"
          item={highRiskCandidate}
          variant="highRisk"
        />
        <TopCandidateCard
          title="Developing setup"
          emptyTitle="NO DEVELOPING SETUP TODAY"
          item={developingSetup}
          variant="developing"
        />
      </div>
    </section>
  );
}
