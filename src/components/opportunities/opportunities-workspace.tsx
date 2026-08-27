"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { OpportunityCandidate } from "@/services/opportunity/present";
import {
  ActionableSetupsSection,
  DailySummaryBar,
} from "@/components/opportunities/daily-summary-bar";
import { OpportunityScreener } from "@/components/opportunities/opportunity-screener";

type OpportunitiesPayload = {
  ok: boolean;
  date: string;
  boardState: string;
  marketRegime: string;
  scanTimestamp: string | null;
  noHighConfidence: boolean;
  bestStock: OpportunityCandidate | null;
  bestCrypto: OpportunityCandidate | null;
  whyNoBestStock?: string | null;
  whyNoBestCrypto?: string | null;
  actionableTrades: OpportunityCandidate[];
  candidates: OpportunityCandidate[];
  discovered: OpportunityCandidate[];
  summary: {
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
  message?: string;
  disclaimer: string;
  schedulerNote?: string;
};

function SignalCard({
  title,
  emptyLabel,
  item,
  emptyReason,
}: {
  title: string;
  emptyLabel: string;
  item: OpportunityCandidate | null;
  emptyReason: string | null | undefined;
}) {
  if (!item || !item.actionable) {
    return (
      <Card className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
          {title}
        </p>
        <p className="text-sm font-semibold">NO CONFIRMED {emptyLabel} SETUP</p>
        <p className="text-xs text-muted">
          {emptyReason ?? "WAIT — no candidate currently meets all trading requirements."}
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 border-accent/40">
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
        <Badge tone={item.direction === "LONG" ? "positive" : "negative"}>
          {item.direction}
        </Badge>
        <Badge tone="positive">{item.quality}</Badge>
        <Badge tone="accent">ELIGIBLE</Badge>
        <Badge tone="neutral">{item.dataQuality}</Badge>
      </div>
      <p className="text-sm font-semibold text-accent">{item.actionLabel}</p>
      <p className="text-xs text-muted">{item.newsSummary.impactExplanation}</p>
    </Card>
  );
}

export function OpportunitiesWorkspace() {
  const [data, setData] = useState<OpportunitiesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/opportunities");
        const payload = (await response.json().catch(() => null)) as
          | OpportunitiesPayload
          | { error?: string }
          | null;
        if (cancelled) return;
        if (!response.ok || !payload || !("ok" in payload) || !payload.ok) {
          setError(
            payload && "error" in payload
              ? payload.error ?? "Failed to load opportunities"
              : "Failed to load opportunities",
          );
          return;
        }
        setData(payload);
      } catch {
        if (!cancelled) setError("Failed to load opportunities");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Card>
        <p className="text-sm text-negative">{error}</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <p className="text-sm text-muted">Loading daily market screener…</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
        <p className="text-sm text-muted">
          Daily market intelligence screener for stocks, ETFs and crypto — stored scan
          data only, {data.date} UTC.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{data.boardState.replace(/_/g, " ")}</Badge>
          <Badge tone="accent">{data.marketRegime}</Badge>
        </div>
      </header>

      <DailySummaryBar
        summary={data.summary}
        marketRegime={data.marketRegime}
        scanTimestamp={data.scanTimestamp}
      />

      <ActionableSetupsSection trades={data.actionableTrades} />

      <div className="grid gap-4 lg:grid-cols-2">
        <SignalCard
          title="Best stock"
          emptyLabel="STOCK"
          item={data.bestStock}
          emptyReason={data.whyNoBestStock}
        />
        <SignalCard
          title="Best crypto"
          emptyLabel="CRYPTO"
          item={data.bestCrypto}
          emptyReason={data.whyNoBestCrypto}
        />
      </div>

      <OpportunityScreener candidates={data.candidates} />

      {data.discovered.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Discovered today</h2>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {data.discovered.slice(0, 9).map((item) => (
              <Card key={item.symbol} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{item.symbol}</span>
                  <Badge tone="warning">{item.boardQualityLabel ?? "DISCOVERED"}</Badge>
                </div>
                <p className="text-xs text-muted">{item.whyRanked}</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <Card className="space-y-2">
        <p className="text-xs text-muted">{data.message}</p>
        <p className="text-xs text-muted">{data.disclaimer}</p>
        {data.schedulerNote ? (
          <p className="text-[11px] text-muted">{data.schedulerNote}</p>
        ) : null}
        <p className="text-[11px] text-muted">
          Stored scan — never invents prices on this page. Paper exit monitoring runs
          separately on Paper Positions.
        </p>
      </Card>
    </div>
  );
}
