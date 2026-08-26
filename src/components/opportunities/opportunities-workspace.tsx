"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { RankedOpportunity } from "@/services/opportunity/types";
import type { PositionExitAlert } from "@/services/exit/monitor";

type OpportunitiesPayload = {
  ok: boolean;
  date: string;
  boardState: "OPPORTUNITIES_AVAILABLE" | "WATCH_ONLY" | "NO_TRADE" | "DATA_INSUFFICIENT";
  marketRegime: string;
  noHighConfidence: boolean;
  topStocks: RankedOpportunity[];
  topCrypto: RankedOpportunity[];
  watch: RankedOpportunity[];
  exitAlerts: PositionExitAlert[];
  message?: string;
  disclaimer: string;
};

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value >= 1000 ? value.toFixed(0) : value.toFixed(2);
}

function ScoreBreakdown({ item }: { item: RankedOpportunity }) {
  const s = item.scores;
  return (
    <div className="grid grid-cols-2 gap-1 text-[10px] text-muted sm:grid-cols-4">
      <span>Tech {s.technicalScore.toFixed(0)}</span>
      <span>Mom {s.momentumScore.toFixed(0)}</span>
      <span>Vol {s.volumeScore.toFixed(0)}</span>
      <span>News {s.newsScore.toFixed(0)}</span>
      <span>Cat {s.catalystScore.toFixed(0)}</span>
      <span>Sent {s.sentimentScore.toFixed(0)}</span>
      <span>Regime {s.marketRegimeScore.toFixed(0)}</span>
      <span>R:R {s.riskRewardScore.toFixed(0)}</span>
    </div>
  );
}

function OpportunityRow({ item }: { item: RankedOpportunity }) {
  const actionable =
    item.tier === "STRONG_OPPORTUNITY" || item.tier === "OPPORTUNITY";
  const confidence = item.scores.opportunityScore;

  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/market/${encodeURIComponent(item.symbol)}`}
            className="font-mono text-base font-semibold hover:text-accent"
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
          <Badge tone={item.tier === "STRONG_OPPORTUNITY" ? "positive" : "neutral"}>
            {item.tier}
          </Badge>
          <Badge tone="neutral">{item.setupType}</Badge>
          <Badge tone="neutral">{item.assetClass}</Badge>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm">Score {confidence.toFixed(1)}</p>
          <p className="text-[10px] text-muted">
            Confidence {confidence.toFixed(0)} · Engine {item.engineScore?.toFixed(0) ?? "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <p className="text-[10px] uppercase text-muted">Price</p>
          <p className="font-mono">{formatPrice(item.currentPrice)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted">Entry zone</p>
          <p className="font-mono">
            {formatPrice(item.entryZoneLow)} – {formatPrice(item.entryZoneHigh)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted">Stop / Invalidation</p>
          <p className="font-mono">{formatPrice(item.stopLoss ?? item.invalidation)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted">TP1 / TP2</p>
          <p className="font-mono">
            {formatPrice(item.takeProfit1)} / {formatPrice(item.takeProfit2)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted">R:R / ATR</p>
          <p className="font-mono">
            {item.riskReward?.toFixed(2) ?? "—"} · {formatPrice(item.atr14)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted">Horizon</p>
          <p className="font-mono">{item.holdingHorizon}</p>
        </div>
      </div>

      <ScoreBreakdown item={item} />

      {!actionable ? (
        <div className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
          <p className="text-xs font-medium">Waiting for confirmation</p>
          <p className="mt-1 text-[11px] text-muted">
            {(item.waitingFor.length > 0
              ? item.waitingFor
              : ["Aligned trend + momentum + EMA stack + MACD"]
            ).join(" · ")}
          </p>
        </div>
      ) : null}

      {item.reasons[0] ? (
        <p className="text-xs text-muted">
          <span className="font-medium text-foreground">Why ranked: </span>
          {item.reasons.slice(0, 2).join(" · ")}
        </p>
      ) : null}

      {actionable && item.invalidation !== null ? (
        <p className="text-xs text-muted">
          <span className="font-medium text-foreground">Invalidation: </span>
          Price through {formatPrice(item.invalidation)}
        </p>
      ) : null}

      {item.newsItems.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[10px] uppercase text-muted">News</p>
          {item.newsItems.slice(0, 2).map((news) => (
            <p key={`${news.title}-${news.publishedAt}`} className="text-[11px] text-muted">
              {news.title}
              {news.source ? ` · ${news.source}` : ""}
              {news.publishedAt
                ? ` · ${new Date(news.publishedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : ""}
              {` · ${news.sentiment} · ${news.category} · impact ${news.impactScore}`}
            </p>
          ))}
        </div>
      ) : item.newsHeadlines[0] ? (
        <p className="text-[11px] text-muted">News: {item.newsHeadlines[0]}</p>
      ) : (
        <p className="text-[11px] text-muted">No symbol-linked news in the latest ingest.</p>
      )}

      <p className="text-[10px] text-muted">
        Data {item.dataStatus} · Regime {item.marketRegime} · Scanned{" "}
        {new Date(item.scannedAt).toLocaleString()} · Engine levels only — not an order.
      </p>
    </Card>
  );
}

function Section({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: RankedOpportunity[];
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {title}
      </h3>
      {items.length === 0 ? (
        <Card>
          <p className="text-sm font-medium">{empty}</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <OpportunityRow key={`${item.symbol}-${item.tier}`} item={item} />
          ))}
        </div>
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

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
          Opportunity intelligence
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
          Stored-first — no provider calls invent prices on this page.
        </p>
      </div>

      {data.boardState === "DATA_INSUFFICIENT" ? (
        <Card>
          <p className="text-sm font-semibold">DATA INSUFFICIENT</p>
          <p className="mt-1 text-xs text-muted">
            {data.message ??
              "No usable LIVE/CACHED scan results for this UTC day. This is not the same as NO_TRADE."}
          </p>
        </Card>
      ) : null}

      {data.boardState === "NO_TRADE" ? (
        <Card>
          <p className="text-sm font-semibold">NO TRADE</p>
          <p className="mt-1 text-xs text-muted">
            {data.message ??
              "Market data was analyzed; evidence did not clear the opportunity bar today."}
          </p>
        </Card>
      ) : null}

      {data.boardState === "WATCH_ONLY" ? (
        <Card>
          <p className="text-sm font-semibold">WATCH ONLY</p>
          <p className="mt-1 text-xs text-muted">
            {data.message ??
              "Interesting candidates exist, but none cleared a full VALID LONG/SHORT opportunity."}
          </p>
        </Card>
      ) : null}

      {data.boardState === "OPPORTUNITIES_AVAILABLE" ? (
        <Card>
          <p className="text-sm font-semibold">OPPORTUNITIES AVAILABLE</p>
          <p className="mt-1 text-xs text-muted">
            Ranked actionable candidates from the latest daily scan. Informational only — not orders.
          </p>
        </Card>
      ) : null}

      {data.exitAlerts.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Positions requiring attention
          </h3>
          <div className="grid gap-2">
            {data.exitAlerts.map((alert) => (
              <Card key={alert.positionId} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{alert.symbol}</span>
                  <Badge tone="neutral">{alert.side}</Badge>
                  <Badge
                    tone={
                      alert.evaluation.urgency === "URGENT_EXIT"
                        ? "negative"
                        : alert.evaluation.urgency === "TAKE_PROFIT"
                          ? "positive"
                          : "neutral"
                    }
                  >
                    {alert.evaluation.state}
                  </Badge>
                  <Badge tone="neutral">{alert.evaluation.urgency}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div>
                    <p className="text-[10px] uppercase text-muted">Action</p>
                    <p className="font-medium">{alert.evaluation.state}</p>
                  </div>
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
                      {alert.evaluation.unrealizedPnLPercent !== null
                        ? `${alert.evaluation.unrealizedPnLPercent.toFixed(2)}%`
                        : "—"}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted">
                  {alert.evaluation.reasons[0] ?? "No reason"}
                  {" · "}
                  {new Date(alert.evaluatedAt).toLocaleString()}
                </p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <Section
        title="Top stock opportunities"
        empty={
          data.boardState === "DATA_INSUFFICIENT"
            ? "DATA INSUFFICIENT — no stored stock opportunities for this day"
            : data.boardState === "WATCH_ONLY"
              ? "No VALID stock setups yet — see Watch for confirmation gaps"
              : "NO actionable stock setups today"
        }
        items={data.topStocks}
      />
      <Section
        title="Top crypto opportunities"
        empty={
          data.boardState === "DATA_INSUFFICIENT"
            ? "DATA INSUFFICIENT — no stored crypto opportunities for this day"
            : data.boardState === "WATCH_ONLY"
              ? "No VALID crypto setups yet — see Watch for confirmation gaps"
              : "NO actionable crypto setups today"
        }
        items={data.topCrypto}
      />
      <Section
        title="Watch"
        empty={
          data.boardState === "DATA_INSUFFICIENT"
            ? "DATA INSUFFICIENT — run the daily cron to populate the board"
            : "No watchlist candidates"
        }
        items={data.watch}
      />

      <p className="text-xs text-muted">{data.disclaimer}</p>
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
