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

type OpportunityCandidate = {
  symbol: string;
  assetType: string;
  direction: string;
  quality: string;
  qualityLabel: string;
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
  reasons: string[];
  confirmation: { explain: string } | null;
  scannedAt: string;
};

type ExitAlert = {
  positionId: string;
  symbol: string;
  side: string;
  exitAction?: string;
  exitUrgency?: string;
  currentPrice: number;
  entryPrice: number;
  unrealizedPnLPercent?: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  exitReason?: string;
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
  watch: OpportunityCandidate[];
  exitAlerts: ExitAlert[];
  whyNoSetup?: string[];
  blockerAggregate?: {
    trendBlocked: number;
    momentumBlocked: number;
    emaBlocked: number;
    macdBlocked: number;
    atrBlocked: number;
    insufficientData: number;
    other: number;
  } | null;
  confirmationSimulation?: {
    activeConfirmationRule?: string;
    currentValid: number;
    alternativeValid: number;
    liveOrCachedEvaluated: number;
    strongConfirmationCount?: number;
    confirmedCount?: number;
    note: string;
  } | null;
  schedulerNote?: string;
  message?: string;
  disclaimer: string;
};

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value >= 1000 ? value.toFixed(0) : value.toFixed(2);
}

function qualityTone(
  quality: string,
): "positive" | "accent" | "warning" | "negative" | "neutral" {
  if (quality === "STRONG") return "positive";
  if (quality === "CONFIRMED") return "accent";
  if (quality === "EARLY_SETUP") return "warning";
  if (quality === "WATCH") return "neutral";
  return "neutral";
}

function CandidateCard({
  item,
  rank,
  emphasize,
}: {
  item: OpportunityCandidate;
  rank?: number;
  emphasize?: boolean;
}) {
  const highConfidence =
    item.quality === "STRONG" || item.quality === "CONFIRMED";

  return (
    <Card className={emphasize ? "space-y-3 border-accent/40" : "space-y-3"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {rank !== undefined ? (
            <span className="font-mono text-xs text-muted">#{rank}</span>
          ) : null}
          <Link
            href={`/market/${encodeURIComponent(item.symbol)}`}
            className="font-mono text-lg font-semibold hover:text-accent"
          >
            {item.symbol}
          </Link>
          <Badge
            tone={
              item.direction === "LONG"
                ? "positive"
                : item.direction === "SHORT"
                  ? "negative"
                  : "neutral"
            }
          >
            {item.direction}
          </Badge>
          <Badge tone={qualityTone(item.quality)}>{item.quality}</Badge>
          <Badge tone="neutral">{item.assetType}</Badge>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm">Score {item.opportunityScore.toFixed(0)}</p>
          <p className="text-[10px] text-muted">Confidence {item.confidence}</p>
        </div>
      </div>

      {!highConfidence ? (
        <p className="text-xs font-medium text-amber-200/90">
          {item.qualityLabel}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <p className="text-[10px] uppercase text-muted">Price</p>
          <p className="font-mono">{formatPrice(item.price)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted">Entry</p>
          <p className="font-mono">
            {item.entryZone
              ? `${formatPrice(item.entryZone.low)} – ${formatPrice(item.entryZone.high)}`
              : formatPrice(item.entry)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted">Stop</p>
          <p className="font-mono">{formatPrice(item.stop)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted">TP1 / TP2</p>
          <p className="font-mono">
            {formatPrice(item.tp1)} / {formatPrice(item.tp2)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted">R:R</p>
          <p className="font-mono">{item.riskReward?.toFixed(2) ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted">Horizon</p>
          <p className="font-mono">{item.timeHorizon}</p>
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase text-muted">Why</p>
        <p className="mt-0.5 text-xs text-muted">{item.thesis}</p>
      </div>

      {item.waitingFor.length > 0 ? (
        <div>
          <p className="text-[10px] uppercase text-muted">Waiting for</p>
          <p className="mt-0.5 text-xs text-muted">{item.waitingFor.join(" · ")}</p>
        </div>
      ) : null}

      {item.invalidation !== null ? (
        <p className="text-xs text-muted">
          Invalidation: {formatPrice(item.invalidation)}
        </p>
      ) : null}

      {item.news.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[10px] uppercase text-muted">News</p>
          {item.news.slice(0, 2).map((news) => (
            <p key={`${news.headline}-${news.publishedAt}`} className="text-[11px] text-muted">
              {news.headline}
              {news.source ? ` · ${news.source}` : ""}
              {news.publishedAt
                ? ` · ${new Date(news.publishedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : ""}
              {` · ${news.sentiment} · ${news.category}`}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted">No symbol-linked recent news.</p>
      )}

      <p className="text-[10px] text-muted">
        Freshness {item.dataQuality} · Data {item.dataStatus} · Regime {item.marketRegime} ·
        Engine levels only — not an order.
      </p>
    </Card>
  );
}

function BestBlock({
  title,
  item,
  emptyReason,
}: {
  title: string;
  item: OpportunityCandidate | null;
  emptyReason: string | null | undefined;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {title}
      </h3>
      {item ? (
        <CandidateCard item={item} emphasize />
      ) : (
        <Card>
          <p className="text-sm font-medium">No high-confidence opportunity currently.</p>
          {emptyReason ? (
            <p className="mt-1 text-xs text-muted">{emptyReason}</p>
          ) : null}
        </Card>
      )}
    </section>
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
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
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
  const rankedPreview = [...data.topStocks, ...data.topCrypto].slice(0, 3);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
          Today&apos;s best opportunities
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
          Stored scan — prices and levels are never invented on this page.
        </p>
      </div>

      {data.noHighConfidence ? (
        <Card>
          <p className="text-sm font-semibold">No high-confidence opportunity currently.</p>
          <p className="mt-1 text-xs text-muted">
            {data.message ??
              "Developing setups may still appear below — they are not buy/sell instructions."}
          </p>
        </Card>
      ) : null}

      {data.boardState === "DATA_INSUFFICIENT" ? (
        <Card>
          <p className="text-sm font-semibold">DATA INSUFFICIENT</p>
          <p className="mt-1 text-xs text-muted">
            {data.message ??
              "No usable LIVE/CACHED scan results for this UTC day."}
          </p>
        </Card>
      ) : null}

      {data.blockerAggregate && data.boardState === "WATCH_ONLY" ? (
        <Card>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
            Signal blockers
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Trend {data.blockerAggregate.trendBlocked}, momentum{" "}
            {data.blockerAggregate.momentumBlocked}, EMA {data.blockerAggregate.emaBlocked},
            MACD {data.blockerAggregate.macdBlocked}
          </p>
        </Card>
      ) : null}

      <BestBlock
        title="Best stock"
        item={data.bestStock}
        emptyReason={data.whyNoBestStock}
      />
      <BestBlock
        title="Best crypto"
        item={data.bestCrypto}
        emptyReason={data.whyNoBestCrypto}
      />

      {rankedPreview.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Ranked board
          </h3>
          <div className="grid gap-3">
            {rankedPreview.map((item, index) => (
              <CandidateCard
                key={`rank-${item.symbol}-${item.quality}`}
                item={item}
                rank={index + 1}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Developing setups
        </h3>
        {developing.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">No developing setups waiting for confirmation.</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {developing.map((item) => (
              <CandidateCard key={`dev-${item.symbol}`} item={item} />
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
          <div className="grid gap-3">
            {data.watch.map((item) => (
              <CandidateCard key={`watch-${item.symbol}`} item={item} />
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
            <p className="text-sm text-muted">No open-position exit alerts right now.</p>
            {data.schedulerNote ? (
              <p className="mt-2 text-[11px] text-muted">{data.schedulerNote}</p>
            ) : null}
          </Card>
        ) : (
          <div className="grid gap-2">
            {data.exitAlerts.map((alert) => {
              const action = alert.exitAction ?? alert.evaluation?.state ?? "HOLD";
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
                      {action}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div>
                      <p className="text-[10px] uppercase text-muted">Price / Entry</p>
                      <p className="font-mono">
                        {formatPrice(alert.currentPrice)} / {formatPrice(alert.entryPrice)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted">Stop / TP1 / TP2</p>
                      <p className="font-mono">
                        {formatPrice(alert.stopLoss)} / {formatPrice(alert.takeProfit1)} /{" "}
                        {formatPrice(alert.takeProfit2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted">P/L</p>
                      <p className="font-mono">
                        {pnl !== null ? `${pnl.toFixed(2)}%` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted">Reason</p>
                      <p className="text-xs">
                        {alert.exitReason ?? alert.evaluation?.reasons[0] ?? "—"}
                      </p>
                    </div>
                  </div>
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
          Paper positions
        </Link>
      </p>
    </div>
  );
}
