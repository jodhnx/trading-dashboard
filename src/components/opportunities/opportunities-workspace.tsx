"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type NewsItem = {
  source: string | null;
  publishedAt: string | null;
  headline: string;
  category: string;
  sentiment: string;
  impact: number;
  relevance: string;
};

type MtfFrame = {
  timeframe: string;
  available: boolean;
  dataStatus: string;
  trend: string;
  momentum: string;
  reason: string | null;
};

type OpportunityCandidate = {
  symbol: string;
  assetType: string;
  direction: string;
  quality: string;
  qualityLabel: string;
  confirmation?: string;
  tradeStatus?: string;
  blockReason?: string | null;
  technicalConfirmation?: string;
  actionable?: boolean;
  action?: string;
  actionLabel?: string;
  opportunityScore: number;
  confidence: number;
  price: number | null;
  entry: number | null;
  entryZone: { low: number | null; high: number | null } | null;
  stop: number | null;
  tp1: number | null;
  tp2: number | null;
  riskReward: number | null;
  timeHorizon: string;
  thesis: string;
  waitingFor: string[];
  invalidation: number | null;
  news: NewsItem[];
  dataQuality: string;
  dataStatus: string;
  marketRegime: string;
  mtfScore?: number;
  mtf?: {
    daily: MtfFrame;
    setup: MtfFrame;
    entry: MtfFrame;
    aligned: boolean;
    score: number;
  };
  reasons: string[];
  confirmationDetail?: { explain: string; trend?: string; momentum?: string; ema?: string; macd?: string } | null;
  scannedAt: string;
};

type ExitAlert = {
  positionId: string;
  symbol: string;
  side: string;
  exitAction?: string;
  exitActionLabel?: string;
  exitUrgency?: string;
  currentPrice: number;
  entryPrice: number;
  unrealizedPnLPercent?: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  exitReason?: string;
  lastChecked?: string;
  evaluatedAt: string;
  evaluation?: {
    state: string;
    urgency: string;
    reasons: string[];
    unrealizedPnLPercent: number | null;
  };
};

type OpportunitiesPayload = {
  ok: boolean;
  date: string;
  boardState: "OPPORTUNITIES_AVAILABLE" | "WATCH_ONLY" | "NO_TRADE" | "DATA_INSUFFICIENT";
  marketRegime: string;
  noHighConfidence: boolean;
  bestStock: OpportunityCandidate | null;
  bestCrypto: OpportunityCandidate | null;
  whyNoBestStock?: string | null;
  whyNoBestCrypto?: string | null;
  topStocks: OpportunityCandidate[];
  topCrypto: OpportunityCandidate[];
  developing?: OpportunityCandidate[];
  blocked?: OpportunityCandidate[];
  watch: OpportunityCandidate[];
  exitAlerts: ExitAlert[];
  exitMonitoringNote?: string;
  summary?: {
    validSetups: number;
    developing: number;
    watch: number;
    blocked: number;
    openPaperHint?: string;
  };
  whyNoSetup?: string[];
  blockerAggregate?: {
    trendBlocked: number;
    momentumBlocked: number;
    emaBlocked: number;
    macdBlocked: number;
    atrBlocked: number;
    riskRewardBlocked?: number;
    insufficientData: number;
    other: number;
  } | null;
  schedulerNote?: string;
  message?: string;
  disclaimer: string;
};

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value >= 1000 ? value.toFixed(0) : value.toFixed(2);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-mono text-sm">{value}</p>
    </div>
  );
}

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

      <p className="text-sm font-semibold text-accent">
        {item.actionLabel ?? "ENTER IN ENTRY ZONE"}
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <Metric label="Price" value={formatPrice(item.price)} />
        <Metric
          label="Entry zone"
          value={
            item.entryZone
              ? `${formatPrice(item.entryZone.low)} – ${formatPrice(item.entryZone.high)}`
              : formatPrice(item.entry)
          }
        />
        <Metric label="Stop" value={formatPrice(item.stop)} />
        <Metric label="TP1" value={formatPrice(item.tp1)} />
        <Metric label="TP2" value={formatPrice(item.tp2)} />
        <Metric
          label="R:R"
          value={item.riskReward !== null ? `1:${item.riskReward.toFixed(2)}` : "—"}
        />
        <Metric label="Confidence" value={`${item.confidence}%`} />
        <Metric
          label="Score / MTF"
          value={`${item.opportunityScore.toFixed(0)} / ${item.mtfScore?.toFixed(0) ?? "—"}`}
        />
      </div>

      <div>
        <p className="text-[10px] uppercase text-muted">Thesis</p>
        <p className="mt-0.5 text-xs text-muted">{item.thesis}</p>
      </div>
      {item.invalidation !== null ? (
        <p className="text-xs text-muted">
          Invalidation: {formatPrice(item.invalidation)}
        </p>
      ) : null}

      {item.mtf ? (
        <div className="grid grid-cols-3 gap-2 text-[11px] text-muted">
          {(["daily", "setup", "entry"] as const).map((key) => {
            const frame = item.mtf![key];
            return (
              <div key={key}>
                <p className="uppercase">{frame.timeframe}</p>
                <p>
                  {frame.available
                    ? `${frame.trend} / ${frame.momentum}`
                    : "DATA UNAVAILABLE"}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}

      {item.news.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[10px] uppercase text-muted">News</p>
          {item.news.slice(0, 3).map((n) => (
            <p key={`${n.headline}-${n.publishedAt}`} className="text-[11px] text-muted">
              {n.headline}
              {n.source ? ` · ${n.source}` : ""}
              {n.publishedAt
                ? ` · ${new Date(n.publishedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : ""}
              {` · ${n.sentiment}`}
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/market/${encodeURIComponent(item.symbol)}`}
          className="inline-flex min-h-10 items-center rounded-md bg-accent px-3 text-sm font-medium text-background hover:bg-accent/90"
        >
          Verify on market page
        </Link>
        <Link
          href="/positions"
          className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-surface-2"
        >
          Paper Positions
        </Link>
      </div>
      <p className="text-[10px] text-muted">
        PAPER workflow only — open trade from the market page after verifying levels.
        Engine levels only. Not a broker order.
      </p>
    </Card>
  );
}

export function OpportunitiesWorkspace() {
  const [data, setData] = useState<OpportunitiesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/opportunities");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as OpportunitiesPayload;
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Card>
        <p className="text-sm font-medium">Could not load opportunities</p>
        <p className="mt-1 text-xs text-muted">{error}</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <p className="text-sm text-muted">Loading stored opportunities…</p>
      </Card>
    );
  }

  const developing = data.developing ?? [];
  const blocked = data.blocked ?? [];
  const hasActionable = Boolean(data.bestStock?.actionable || data.bestCrypto?.actionable);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
          Today&apos;s trading signal
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          {data.date}
          <span className="ml-2 text-sm font-normal text-muted">UTC</span>
        </h2>
        <p className="mt-1 text-sm text-muted">
          Regime: <span className="font-medium text-foreground">{data.marketRegime}</span>
          {" · "}
          Board: <span className="font-medium text-foreground">{data.boardState}</span>
          {" · "}
          Stored scan — never invents prices on this page.
        </p>
      </div>

      <Card>
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
          Daily summary
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-8">
          <Metric label="Regime" value={data.marketRegime} />
          <Metric label="Best stock" value={data.bestStock?.actionable ? data.bestStock.symbol : "WAIT"} />
          <Metric label="Best crypto" value={data.bestCrypto?.actionable ? data.bestCrypto.symbol : "WAIT"} />
          <Metric label="Valid" value={String(data.summary?.validSetups ?? 0)} />
          <Metric label="Developing" value={String(data.summary?.developing ?? developing.length)} />
          <Metric label="Watch" value={String(data.summary?.watch ?? data.watch.length)} />
          <Metric label="Blocked" value={String(data.summary?.blocked ?? blocked.length)} />
          <Metric label="Exits" value={String(data.exitAlerts.length)} />
        </div>
      </Card>

      {!hasActionable ? (
        <Card className="space-y-2">
          <p className="text-sm font-semibold">NO TRADE TODAY</p>
          <p className="text-xs text-muted">WAITING FOR CONFIRMATION</p>
          <p className="text-xs text-muted">
            {data.message ??
              "No CONFIRMED/STRONG + ELIGIBLE setup with valid levels. This is a valid outcome."}
          </p>
          {data.blockerAggregate ? (
            <p className="text-[11px] text-muted">
              Top blockers — trend {data.blockerAggregate.trendBlocked}, momentum{" "}
              {data.blockerAggregate.momentumBlocked}, EMA {data.blockerAggregate.emaBlocked},
              MACD {data.blockerAggregate.macdBlocked}
              {typeof data.blockerAggregate.riskRewardBlocked === "number"
                ? `, R:R ${data.blockerAggregate.riskRewardBlocked}`
                : ""}
              , data {data.blockerAggregate.insufficientData}.
            </p>
          ) : null}
        </Card>
      ) : null}

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

      <section className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Developing setups
        </h3>
        {developing.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">No developing setups.</p>
          </Card>
        ) : (
          <div className="grid gap-2">
            {developing.map((item) => (
              <Card key={`dev-${item.symbol}`} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{item.symbol}</span>
                  <Badge tone="warning">EARLY_SETUP</Badge>
                  <Badge tone="neutral">WAIT FOR CONFIRMATION</Badge>
                </div>
                <p className="text-xs text-muted">
                  {(item.waitingFor.length > 0
                    ? item.waitingFor
                    : ["Confirmation incomplete"]
                  ).join(" · ")}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Blocked technical setups
        </h3>
        {blocked.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">No blocked setups.</p>
          </Card>
        ) : (
          <div className="grid gap-2">
            {blocked.map((item) => (
              <Card key={`blk-${item.symbol}`} className="space-y-2 border-warning/30">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{item.symbol}</span>
                  <Badge tone="accent">{item.confirmation ?? "STRONG"}</Badge>
                  <Badge tone="warning">BLOCKED</Badge>
                  <Badge
                    tone={
                      item.direction === "SHORT"
                        ? "negative"
                        : item.direction === "LONG"
                          ? "positive"
                          : "neutral"
                    }
                  >
                    {item.direction}
                  </Badge>
                </div>
                <p className="text-xs font-medium">DO NOT ENTER</p>
                <p className="text-[11px] text-muted">
                  Reason: {item.blockReason ?? "Final trade gate failed"}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Watchlist
        </h3>
        {data.watch.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">No watchlist candidates.</p>
          </Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {data.watch.slice(0, 8).map((item) => (
              <Card key={`w-${item.symbol}`} className="space-y-1 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{item.symbol}</span>
                  <Badge tone="neutral">WATCH</Badge>
                  <span className="font-mono text-[11px] text-muted">
                    {item.opportunityScore.toFixed(0)}
                  </span>
                </div>
                <p className="text-[11px] text-muted">
                  {item.confirmationDetail
                    ? `${item.confirmationDetail.trend} · ${item.confirmationDetail.momentum} · EMA ${item.confirmationDetail.ema} · MACD ${item.confirmationDetail.macd}`
                    : item.waitingFor[0] ?? item.thesis}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Exit alerts
        </h3>
        {data.exitAlerts.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">
              No stored exit alerts on this board.
            </p>
            {data.exitMonitoringNote ? (
              <p className="mt-2 text-[11px] text-muted">{data.exitMonitoringNote}</p>
            ) : null}
            {data.schedulerNote ? (
              <p className="mt-2 text-[11px] text-muted">{data.schedulerNote}</p>
            ) : null}
          </Card>
        ) : (
          <div className="grid gap-2">
            {data.exitAlerts.map((alert) => {
              const label =
                alert.exitActionLabel ??
                alert.exitAction ??
                alert.evaluation?.state ??
                "HOLD";
              const urgency =
                alert.exitUrgency ?? alert.evaluation?.urgency ?? "HOLD";
              const pnl =
                alert.unrealizedPnLPercent ??
                alert.evaluation?.unrealizedPnLPercent ??
                null;
              return (
                <Card key={alert.positionId} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold">{alert.symbol}</span>
                    <Badge tone="neutral">{alert.side}</Badge>
                    <Badge
                      tone={
                        urgency === "URGENT_EXIT"
                          ? "negative"
                          : urgency === "TAKE_PROFIT"
                            ? "positive"
                            : "neutral"
                      }
                    >
                      {label}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <Metric
                      label="Price / Entry"
                      value={`${formatPrice(alert.currentPrice)} / ${formatPrice(alert.entryPrice)}`}
                    />
                    <Metric
                      label="Stop / TP1 / TP2"
                      value={`${formatPrice(alert.stopLoss)} / ${formatPrice(alert.takeProfit1)} / ${formatPrice(alert.takeProfit2)}`}
                    />
                    <Metric
                      label="P/L"
                      value={pnl !== null ? `${pnl.toFixed(2)}%` : "—"}
                    />
                    <Metric
                      label="Last checked"
                      value={new Date(
                        alert.lastChecked ?? alert.evaluatedAt,
                      ).toLocaleString()}
                    />
                  </div>
                  <p className="text-[11px] text-muted">
                    {alert.exitReason ?? alert.evaluation?.reasons[0] ?? "—"}
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-xs text-muted">{data.disclaimer}</p>
      {data.schedulerNote ? (
        <p className="text-xs text-muted">{data.schedulerNote}</p>
      ) : null}
      <p className="text-xs text-muted">
        <Link href="/daily-brief" className="text-accent hover:underline">
          Open Daily Brief
        </Link>
        {" · "}
        <Link href="/positions" className="text-accent hover:underline">
          Paper Positions
        </Link>
      </p>
    </div>
  );
}
