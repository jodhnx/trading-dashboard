"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataStatusBadge } from "@/components/market/data-status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import type { DailyBriefRecord } from "@/services/daily-brief/types";
import type { DataStatus } from "@/services/market/provider";
import { DATA_STATUSES } from "@/services/market/provider";

function asDataStatus(value: string): DataStatus {
  return (DATA_STATUSES as readonly string[]).includes(value)
    ? (value as DataStatus)
    : "UNAVAILABLE";
}

function statusTone(
  status: DailyBriefRecord["finalStatus"],
): "positive" | "warning" | "accent" {
  if (status === "TRADE") return "positive";
  if (status === "WATCH") return "accent";
  return "warning";
}

function formatPrice(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(2);
}

function formatQty(value: number | null): string {
  if (value === null) return "—";
  if (Math.abs(value) >= 100) return value.toFixed(2);
  if (Math.abs(value) >= 1) return value.toFixed(4);
  return value.toFixed(6);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-2/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono text-sm font-medium">{value}</p>
    </div>
  );
}

export function DailyBriefView({
  brief,
  history,
}: {
  brief: DailyBriefRecord | null;
  history: DailyBriefRecord[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ title: string; description: string } | null>(
    null,
  );
  const [latest, setLatest] = useState(brief);

  async function generate() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/daily-brief/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await response.json().catch(() => null)) as {
        brief?: DailyBriefRecord;
        code?: string;
        error?: string;
      } | null;
      if (!response.ok || !body?.brief) {
        setError({
          title: body?.code ?? "GENERATE_FAILED",
          description:
            body?.error ??
            "Daily Brief could not be generated. No fantasy fallback was stored.",
        });
        return;
      }
      setLatest(body.brief);
      router.refresh();
    } catch {
      setError({
        title: "GENERATE_FAILED",
        description: "Network error while generating the Daily Brief.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Daily Brief</h2>
          <p className="text-sm text-muted">
            Reads stored briefs only. Generation is explicit — no OpenAI or market
            scan on page load.
          </p>
        </div>
        <Button type="button" disabled={pending} onClick={() => void generate()}>
          {pending ? "Generating…" : "Generate Today’s Brief"}
        </Button>
      </div>

      {error ? (
        <ErrorState title={error.title} description={error.description} />
      ) : null}

      {pending && !latest ? (
        <p className="text-sm text-muted">Generating Daily Brief…</p>
      ) : null}

      {!pending && !latest ? (
        <EmptyState
          title="NO DAILY BRIEF"
          description="No stored brief for today. Click Generate Today’s Brief to assemble market, news, setups, and AI summaries."
        />
      ) : null}

      {latest ? <BriefBody brief={latest} /> : null}

      {history.length > 0 ? (
        <Card className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
            History
          </h3>
          <ul className="space-y-1 text-sm text-muted">
            {history.map((item) => (
              <li key={item.id}>
                {item.briefDate}
                {" · "}
                {item.finalStatus}
                {" · "}
                {item.dataStatus}
                {item.isStale ? " · STALE" : ""}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function BriefBody({ brief }: { brief: DailyBriefRecord }) {
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(brief.finalStatus)}>{brief.finalStatus}</Badge>
          <DataStatusBadge status={asDataStatus(brief.dataStatus)} />
          {brief.isStale ? <Badge tone="warning">STALE DATA</Badge> : null}
          {brief.isMock ? (
            <Badge tone="warning">Mock — not a live recommendation</Badge>
          ) : null}
        </div>
        <p className="text-xs font-medium text-muted">
          Research brief — not an executed order. Engine values are authoritative.
        </p>
        <p className="text-sm">{brief.summary}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Brief date (UTC)" value={brief.briefDate} />
          <Metric label="Market regime" value={brief.marketRegime ?? "UNKNOWN"} />
          <Metric
            label="Risk environment"
            value={brief.riskEnvironment ?? "UNKNOWN"}
          />
          <Metric label="AI status" value={brief.aiStatus} />
        </div>
        <p className="text-xs text-muted">
          Generated {new Date(brief.generatedAt).toLocaleString("de-DE")}
          {brief.model ? ` · Model ${brief.model}` : ""}
          {brief.promptVersion ? ` · ${brief.promptVersion}` : ""}
        </p>
      </Card>

      <Card className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Market overview
        </h3>
        {brief.marketOverview.length === 0 ? (
          <p className="text-sm text-muted">DATA UNAVAILABLE</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {brief.marketOverview.map((item) => (
              <li key={item.symbol} className="flex flex-wrap gap-2">
                <span className="font-medium">{item.symbol}</span>
                <span className="font-mono">{formatPrice(item.price)}</span>
                <span className="text-muted">
                  {item.changePercent !== null
                    ? `${item.changePercent.toFixed(2)}%`
                    : "—"}
                </span>
                <span className="text-muted">{item.dataStatus}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Top opportunities
        </h3>
        {brief.topOpportunities.length === 0 ? (
          <p className="text-sm text-muted">NO TRADE — no VALID engine setups.</p>
        ) : (
          <ul className="space-y-3">
            {brief.topOpportunities.map((item) => (
              <li key={item.symbol} className="space-y-1 text-sm">
                <p className="font-medium">
                  {item.symbol} · {item.direction} · score{" "}
                  {item.score === null ? "—" : item.score.toFixed(1)}
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  <Metric label="Entry" value={formatPrice(item.entry)} />
                  <Metric label="Stop" value={formatPrice(item.stopLoss)} />
                  <Metric label="Target" value={formatPrice(item.takeProfit)} />
                  <Metric
                    label="R:R"
                    value={
                      item.riskReward === null
                        ? "—"
                        : `${item.riskReward.toFixed(2)} : 1`
                    }
                  />
                  <Metric label="Size" value={formatQty(item.positionSize)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Watchlist
          </h3>
          {brief.watchlist.length === 0 ? (
            <p className="text-sm text-muted">None</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {brief.watchlist.map((item) => (
                <li key={item.symbol}>
                  {item.symbol}: {item.reason}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
            NO TRADE assets
          </h3>
          {brief.noTradeAssets.length === 0 ? (
            <p className="text-sm text-muted">None</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {brief.noTradeAssets.map((item) => (
                <li key={item.symbol}>
                  {item.symbol}: {item.reasons.join("; ") || "NO TRADE"}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Technical conditions
        </h3>
        <ul className="space-y-1 text-sm">
          {brief.technicalConditions.map((item) => (
            <li key={item.symbol}>
              {item.symbol}: {item.trend} / {item.momentum} / {item.technicalCondition}{" "}
              · {item.dataStatus}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Relevant news
        </h3>
        {brief.importantNews.length === 0 ? (
          <p className="text-sm text-muted">No news available for this brief.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {brief.importantNews.map((item) => (
              <li key={item.id}>
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-muted">
                  {item.sourceName}
                  {" · "}
                  {new Date(item.publishedAt).toLocaleString("de-DE")}
                </p>
                {item.sourceUrl ? (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-accent hover:underline"
                  >
                    Original source
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Macro / events
        </h3>
        {brief.macroEvents.length === 0 ? (
          <p className="text-sm text-muted">
            No stored macro events for this date (UNKNOWN / empty — not invented).
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {brief.macroEvents.map((item) => (
              <li key={item.id}>
                {item.eventName}
                {" · "}
                {new Date(item.scheduledAt).toLocaleString("de-DE")}
                {item.importance ? ` · ${item.importance}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          AI analyses (stored)
        </h3>
        {brief.aiAnalyses.length === 0 ? (
          <p className="text-sm text-muted">
            No stored Phase 8 analyses attached. Run Analyze Setup per asset if needed.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {brief.aiAnalyses.map((item) => (
              <li key={`${item.symbol}-${item.id ?? item.analyzedAt}`}>
                {item.symbol}: {item.decision}
                {item.confidence !== null ? ` · confidence ${item.confidence}` : ""}
                {item.summary ? ` — ${item.summary}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Risks
        </h3>
        {brief.risks.length === 0 ? (
          <p className="text-sm text-muted">None listed</p>
        ) : (
          <ul className="list-disc space-y-0.5 pl-4 text-sm">
            {brief.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
