"use client";

import { useState } from "react";
import type { OpportunityCandidate } from "@/services/opportunity/present";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  computePositionPlan,
  formatOpportunityPrice,
  formatRiskPercent,
  formatTimestamp,
  freshnessBadgeLabel,
} from "@/services/opportunity/ui-utils";

export function PositionPlanner({ item }: { item: OpportunityCandidate }) {
  const [capital, setCapital] = useState(10000);

  const plan = computePositionPlan({
    accountCapital: capital,
    item: {
      entry: item.entry,
      stopLoss: item.stop,
      takeProfit1: item.tp1,
      takeProfit2: item.tp2,
      direction: item.direction === "SHORT" ? "SHORT" : "LONG",
    },
    riskLevel: item.riskLevel ?? "UNKNOWN",
    recommendedRiskPercent: item.recommendedRiskPercent,
  });

  return (
    <Card className="space-y-3 border-border/70 bg-surface/30">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Position planning tool
        </p>
        <p className="text-xs text-muted">
          Informational sizing only — not a guaranteed result or broker instruction.
        </p>
      </div>
      <label className="block space-y-1 text-xs">
        <span className="text-muted">Account capital</span>
        <Input
          type="number"
          min={0}
          step={100}
          value={capital}
          onChange={(event) => setCapital(Number(event.target.value) || 0)}
        />
      </label>
      {plan.valid ? (
        <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <Metric label="Recommended risk %" value={formatRiskPercent(plan.recommendedRiskPercent)} />
          <Metric label="Maximum monetary risk" value={formatOpportunityPrice(plan.maximumRiskAmount)} />
          <Metric label="Entry" value={formatOpportunityPrice(plan.entry)} />
          <Metric label="Stop" value={formatOpportunityPrice(plan.stopLoss)} />
          <Metric
            label="Stop distance"
            value={
              plan.stopDistancePercent !== null
                ? `${plan.stopDistancePercent.toFixed(2)}%`
                : "—"
            }
          />
          <Metric label="Position size" value={plan.positionSize?.toFixed(4) ?? "—"} />
          <Metric label="Potential loss" value={formatOpportunityPrice(plan.potentialLoss)} />
          <Metric label="TP1 potential gain" value={formatOpportunityPrice(plan.tp1Gain)} />
          <Metric label="TP2 potential gain" value={formatOpportunityPrice(plan.tp2Gain)} />
        </div>
      ) : (
        <p className="text-xs text-muted">{plan.reason}</p>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/60 px-2 py-1.5">
      <p className="text-muted">{label}</p>
      <p className="font-mono">{value}</p>
    </div>
  );
}

export function CandidateDetailPanel({
  item,
  onClose,
}: {
  item: OpportunityCandidate;
  onClose: () => void;
}) {
  const blocked =
    item.tradeStatus === "BLOCKED"
      ? `Technical confirmation exists, but this setup is not actionable because: ${(item.blockReason ?? "unknown").replace(/_/g, " ").toLowerCase()}.`
      : "";
  const dataSkip =
    item.boardQuality === "DATA_SKIP" || item.quality === "DATA_INSUFFICIENT"
      ? "Market data unavailable from the configured provider for this symbol. This is a data quality state — not a bearish market signal."
      : "";

  return (
    <Card className="space-y-4 border-accent/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-xl font-semibold">{item.symbol}</h3>
          <p className="text-xs text-muted">
            {item.name} · {item.assetType}
            {item.sector ? ` · ${item.sector}` : ""}
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge tone="accent">{item.aiView.label}</Badge>
        <Badge tone="neutral">{item.boardQualityLabel ?? item.quality}</Badge>
        <Badge tone="neutral">{freshnessBadgeLabel(item.dataQuality)}</Badge>
      </div>
      <p className="text-sm text-muted">{item.aiView.explanation}</p>

      {blocked ? (
        <div className="rounded-md border border-negative/30 bg-negative/5 p-3 text-xs">
          <p className="font-medium uppercase text-negative">Blocked</p>
          <p className="mt-1">{blocked}</p>
        </div>
      ) : null}
      {dataSkip ? (
        <div className="rounded-md border border-border/70 bg-surface/40 p-3 text-xs">
          <p className="font-medium uppercase text-muted">Data skip</p>
          <p className="mt-1">{dataSkip}</p>
        </div>
      ) : null}

      <Section title="Overview">
        <p className="text-sm">{item.thesis}</p>
        <p className="text-xs text-muted">{item.whyRanked}</p>
      </Section>

      <Section title="Price and levels">
        <Grid
          rows={[
            ["Price", formatOpportunityPrice(item.price)],
            ["Entry", formatOpportunityPrice(item.entry)],
            ["Stop", formatOpportunityPrice(item.stop)],
            ["TP1", formatOpportunityPrice(item.tp1)],
            ["TP2", formatOpportunityPrice(item.tp2)],
            ["R:R", item.riskReward?.toFixed(2) ?? "—"],
          ]}
        />
      </Section>

      <Section title="Technical analysis">
        <Grid
          rows={[
            ["Trend", item.confirmationDetail?.trend ?? "—"],
            ["Momentum", item.confirmationDetail?.momentum ?? "—"],
            ["EMA", item.confirmationDetail?.ema ?? "—"],
            ["MACD", item.confirmationDetail?.macd ?? "—"],
            ["MTF score", String(item.mtfScore ?? "—")],
            ["Confirmation", item.confirmationDetail?.confirmation ?? item.confirmation],
          ]}
        />
        {item.missingConfirmation.length > 0 ? (
          <ul className="mt-2 list-disc pl-4 text-xs text-muted">
            {item.missingConfirmation.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section title="News intelligence">
        {item.news.length > 0 ? (
          <div className="space-y-2">
            {item.news.map((article) => (
              <div key={`${article.headline}-${article.publishedAt}`} className="rounded border p-2 text-xs">
                <p className="font-medium">{article.headline}</p>
                <p className="text-muted">
                  {article.source ?? "Unknown"} · {formatTimestamp(article.publishedAt)} ·{" "}
                  {article.sentiment} · {article.category} · impact {article.impact}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted">No relevant stored news for this symbol.</p>
        )}
      </Section>

      <Section title="AI research">
        {item.aiResearch && !item.aiResearch.unavailable ? (
          <div className="space-y-2 text-xs">
            <p>{item.aiResearch.summary}</p>
            <p>
              <span className="text-muted">Bull case:</span> {item.aiResearch.bullCase}
            </p>
            <p>
              <span className="text-muted">Bear case:</span> {item.aiResearch.bearCase}
            </p>
            <p>
              <span className="text-muted">Key catalyst:</span>{" "}
              {item.aiResearch.keyCatalyst ?? "None identified in stored data"}
            </p>
            <p>
              <span className="text-muted">Main risk:</span> {item.aiResearch.mainRisk}
            </p>
            <p>
              <span className="text-muted">What invalidates:</span>{" "}
              {item.aiResearch.whatWouldInvalidate}
            </p>
            <p>
              <span className="text-muted">Confidence:</span>{" "}
              {item.aiResearch.researchConfidence}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted">
            AI research not available for this candidate — deterministic scan data only.
          </p>
        )}
      </Section>

      <Section title="Risk">
        <Grid
          rows={[
            ["Risk level", item.riskLevel ?? "UNKNOWN"],
            ["Recommended risk %", formatRiskPercent(item.recommendedRiskPercent)],
            ["Position size (scan)", item.positionSize?.toFixed(4) ?? "—"],
          ]}
        />
      </Section>

      <Section title="Freshness">
        <Grid
          rows={[
            ["Market", formatTimestamp(item.marketUpdatedAt)],
            ["Technical", formatTimestamp(item.technicalCalculatedAt)],
            ["News", formatTimestamp(item.newsUpdatedAt)],
            ["AI", formatTimestamp(item.aiAnalyzedAt)],
            ["Scanned", formatTimestamp(item.scannedAt)],
          ]}
        />
      </Section>

      {item.actionable || (item.entry && item.stop) ? (
        <PositionPlanner item={item} />
      ) : null}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{title}</p>
      {children}
    </div>
  );
}

function Grid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label}>
          <p className="text-muted">{label}</p>
          <p className="font-mono">{value}</p>
        </div>
      ))}
    </div>
  );
}
