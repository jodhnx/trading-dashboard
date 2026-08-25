"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataStatusBadge } from "@/components/market/data-status-badge";
import { ErrorState } from "@/components/states/error-state";
import type { TradingAnalysisRecord } from "@/ai/types";
import type { AnalysisErrorCode } from "@/ai/types";
import type { AnalysisDecision } from "@/types/enums";
import { DATA_STATUSES, type DataStatus } from "@/services/market/provider";

const ERROR_COPY: Record<AnalysisErrorCode, { title: string; description: string }> = {
  AI_UNAVAILABLE: {
    title: "AI_UNAVAILABLE",
    description: "OpenAI is not available. No analysis was stored.",
  },
  AI_TIMEOUT: {
    title: "AI_TIMEOUT",
    description: "The analysis request timed out. Try again.",
  },
  AI_ANALYSIS_INVALID: {
    title: "AI_ANALYSIS_INVALID",
    description: "The model returned output that failed schema or business validation.",
  },
  DATA_UNAVAILABLE: {
    title: "DATA_UNAVAILABLE",
    description: "Market data is unavailable. Analysis was not requested.",
  },
  STALE_DATA: {
    title: "STALE_DATA",
    description: "Stale market data cannot be classified as a buy or short setup.",
  },
  INVALID_SETUP: {
    title: "INVALID_SETUP",
    description: "The trading engine setup is not VALID, so BUY_SETUP and SHORT_SETUP are rejected.",
  },
  REQUEST_IN_PROGRESS: {
    title: "REQUEST_IN_PROGRESS",
    description: "An analysis for this symbol is already running.",
  },
};

function decisionLabel(decision: AnalysisDecision): string {
  switch (decision) {
    case "BUY_SETUP":
      return "BUY SETUP";
    case "SHORT_SETUP":
      return "SHORT SETUP";
    case "WATCHLIST":
      return "WATCHLIST";
    case "NO_TRADE":
      return "NO TRADE";
  }
}

function decisionTone(
  decision: AnalysisDecision,
): "positive" | "negative" | "warning" | "accent" {
  if (decision === "BUY_SETUP") return "positive";
  if (decision === "SHORT_SETUP") return "negative";
  if (decision === "WATCHLIST") return "accent";
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

function formatRr(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(2)} : 1`;
}

function asDataStatus(value: string): DataStatus {
  return (DATA_STATUSES as readonly string[]).includes(value)
    ? (value as DataStatus)
    : "UNAVAILABLE";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-2/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono text-sm font-medium">{value}</p>
    </div>
  );
}

function SignalList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted">None</p>
      ) : (
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AnalysisResult({ analysis }: { analysis: TradingAnalysisRecord }) {
  const dataStatus = asDataStatus(analysis.dataStatus);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={decisionTone(analysis.decision)}>
          {decisionLabel(analysis.decision)}
        </Badge>
        <DataStatusBadge status={dataStatus} />
        {analysis.isMock ? (
          <Badge tone="warning">Mock — not a live recommendation</Badge>
        ) : null}
      </div>
      <p className="text-xs font-medium text-muted">
        AI analysis — not an executed order
      </p>
      <p className="text-sm">{analysis.summary}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Metric
          label="Confidence"
          value={`${Math.round(analysis.confidence)}`}
        />
        <Metric label="Entry" value={formatPrice(analysis.setupReference.entry)} />
        <Metric label="Stop loss" value={formatPrice(analysis.setupReference.stopLoss)} />
        <Metric
          label="Take profit"
          value={formatPrice(analysis.setupReference.takeProfit)}
        />
        <Metric
          label="Risk / Reward"
          value={formatRr(analysis.setupReference.riskReward)}
        />
        <Metric
          label="Position size"
          value={formatQty(analysis.setupReference.positionSize)}
        />
        <Metric label="News impact" value={analysis.newsImpact} />
        <Metric label="Time horizon" value={analysis.timeHorizon} />
      </div>
      <p className="text-xs text-muted">
        Confidence measures how consistent the provided data are with this
        classification. It is not a win probability and not expected return.
      </p>
      <SignalList title="Thesis" items={analysis.thesis} />
      <SignalList title="Supporting signals" items={analysis.supportingSignals} />
      <SignalList title="Contradicting signals" items={analysis.contradictingSignals} />
      <SignalList title="Risks" items={analysis.risks} />
      <SignalList title="Uncertainties" items={analysis.uncertainties} />

      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
          News sources
        </p>
        {analysis.news.length === 0 ? (
          <p className="mt-1 text-sm text-muted">No news items were sent to the model.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {analysis.news.map((item) => (
              <li key={item.id} className="text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-muted">
                  {item.sourceName}
                  {" · "}
                  {new Date(item.publishedAt).toLocaleString("de-DE")}
                  {item.freshness ? ` · ${item.freshness}` : ""}
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
      </div>

      <p className="text-xs text-muted">
        Model {analysis.model}
        {" · "}
        Analyzed {new Date(analysis.analyzedAt).toLocaleString("de-DE")}
        {" · "}
        Data{" "}
        {analysis.dataTimestamp
          ? new Date(analysis.dataTimestamp).toLocaleString("de-DE")
          : "unknown"}
        {" · "}
        Status {analysis.dataStatus}
        {" · "}
        {analysis.newsCount} news item{analysis.newsCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export function AiAnalysisPanel({
  symbol,
  timeframe,
  initialHistory,
}: {
  symbol: string;
  timeframe: string;
  initialHistory: TradingAnalysisRecord[];
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ title: string; description: string } | null>(
    null,
  );
  const [latest, setLatest] = useState<TradingAnalysisRecord | null>(
    initialHistory[0] ?? null,
  );
  const [history, setHistory] = useState(initialHistory);

  async function analyze() {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, timeframe }),
      });
      const body = (await response.json().catch(() => null)) as {
        analysis?: TradingAnalysisRecord;
        code?: AnalysisErrorCode;
        error?: string;
      } | null;
      if (!response.ok || !body?.analysis) {
        const mapped = body?.code ? ERROR_COPY[body.code] : null;
        setError({
          title: mapped?.title ?? body?.code ?? "AI_UNAVAILABLE",
          description:
            body?.error ?? mapped?.description ?? "Analysis failed.",
        });
        return;
      }
      setLatest(body.analysis);
      setHistory((current) => [
        body.analysis!,
        ...current.filter((item) => item.id !== body.analysis!.id),
      ]);
    } catch {
      setError(ERROR_COPY.AI_UNAVAILABLE);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          AI Analysis
        </h3>
        <Button type="button" disabled={pending} onClick={() => void analyze()}>
          {pending ? "Analyzing…" : "Analyze Setup"}
        </Button>
      </div>
      <p className="text-xs text-muted">
        Runs only when you click the button. Confidence is not a win chance.
        Entry, stop, target, and size come from the trading engine.
      </p>

      {error ? (
        <ErrorState title={error.title} description={error.description} />
      ) : null}

      {pending && !latest ? (
        <p className="text-sm text-muted">Analyzing…</p>
      ) : null}

      {!pending && !latest && !error ? (
        <p className="text-sm text-muted">
          No analysis yet. Click Analyze Setup to evaluate the current technical
          snapshot, news, and trading setup.
        </p>
      ) : null}

      {latest ? <AnalysisResult analysis={latest} /> : null}

      {history.length > 0 ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            History
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {history.map((item, index) => (
              <li key={item.id ?? `${item.analyzedAt}-${index}`} className="text-muted">
                {new Date(item.analyzedAt).toLocaleString("de-DE")}
                {" · "}
                {decisionLabel(item.decision)}
                {" · "}
                confidence {Math.round(item.confidence)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
