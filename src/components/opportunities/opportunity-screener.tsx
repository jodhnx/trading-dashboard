"use client";

import { useMemo, useState } from "react";
import type { OpportunityCandidate } from "@/services/opportunity/present";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  filterCandidates,
  sortCandidates,
  type TableFilter,
  type TableSortKey,
} from "@/services/opportunity/table-utils";
import type { RankedOpportunity } from "@/services/opportunity/types";

const FILTERS: Array<{ id: TableFilter; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "STOCK", label: "Stocks" },
  { id: "CRYPTO", label: "Crypto" },
  { id: "ETF", label: "ETF" },
  { id: "TRADE", label: "Trade" },
  { id: "DEVELOPING", label: "Developing" },
  { id: "SPECULATIVE", label: "Speculative" },
  { id: "WATCH", label: "Watch" },
  { id: "BLOCKED", label: "Blocked" },
  { id: "HIGH_RISK", label: "High risk" },
  { id: "LONG", label: "Long" },
  { id: "SHORT", label: "Short" },
  { id: "NEWS_POSITIVE", label: "News +" },
  { id: "NEWS_NEGATIVE", label: "News −" },
  { id: "HIGH_NEWS_IMPACT", label: "High news" },
  { id: "DISCOVERED", label: "Discovered" },
];

const SORTS: Array<{ id: TableSortKey; label: string }> = [
  { id: "default", label: "Default rank" },
  { id: "score", label: "Score" },
  { id: "risk", label: "Risk" },
  { id: "newsImpact", label: "News impact" },
  { id: "newsRecency", label: "News recency" },
  { id: "riskReward", label: "R:R" },
  { id: "symbol", label: "Symbol" },
];

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value >= 1000 ? value.toFixed(0) : value.toFixed(2);
}

function boardTone(
  quality: string | null | undefined,
): "positive" | "negative" | "warning" | "accent" | "neutral" {
  switch (quality) {
    case "TRADE":
      return "positive";
    case "SPECULATIVE":
    case "DEVELOPING":
      return "warning";
    case "BLOCKED":
      return "negative";
    case "WATCH":
      return "accent";
    default:
      return "neutral";
  }
}

function candidateAsRanked(item: OpportunityCandidate): RankedOpportunity {
  return {
    symbol: item.symbol,
    name: item.name,
    assetClass: item.assetType as RankedOpportunity["assetClass"],
    direction: item.direction as RankedOpportunity["direction"],
    tier: item.tier,
    quality: item.quality as RankedOpportunity["quality"],
    technicalConfirmation: item.technicalConfirmation,
    tradeStatus: item.tradeStatus ?? "NO_TRADE",
    blockReason: item.blockReason ?? null,
    setupType: item.setupType,
    holdingHorizon: item.timeHorizon as RankedOpportunity["holdingHorizon"],
    currentPrice: item.price,
    atr14: null,
    engineScore: null,
    entry: item.entry,
    entryZoneLow: item.entryZone?.low ?? null,
    entryZoneHigh: item.entryZone?.high ?? null,
    maxChase: null,
    stopLoss: item.stop,
    takeProfit1: item.tp1,
    takeProfit2: item.tp2,
    invalidation: item.invalidation,
    riskReward: item.riskReward,
    positionSize: item.positionSize,
    riskAmount: null,
    scores: {
      ...item.scores,
      weights: item.weights,
    },
    marketRegime: item.marketRegime as RankedOpportunity["marketRegime"],
    dataStatus: item.dataStatus as RankedOpportunity["dataStatus"],
    dataFreshness: item.dataQuality as RankedOpportunity["dataFreshness"],
    confidence: item.confidence,
    thesis: item.thesis,
    mtf: item.mtf,
    reasons: item.reasons,
    risks: item.risks,
    waitingFor: item.waitingFor,
    newsHeadlines: item.news.map((n) => n.headline),
    newsItems: item.news.map((n) => ({
      title: n.headline,
      source: n.source,
      publishedAt: n.publishedAt,
      sentiment: n.sentiment,
      category: n.category,
      relevance: n.relevance,
      impactScore: n.impact,
    })),
    confirmation: item.confirmationDetail ?? null,
    scannedAt: item.scannedAt,
    boardQuality: item.boardQuality as RankedOpportunity["boardQuality"],
    riskLevel: item.riskLevel as RankedOpportunity["riskLevel"],
    recommendedRiskPercent: item.recommendedRiskPercent,
    discoveryTags: item.discoveryTags as RankedOpportunity["discoveryTags"],
    screenScore: item.screenScore,
  };
}

function DetailPanel({
  item,
  onClose,
}: {
  item: OpportunityCandidate;
  onClose: () => void;
}) {
  return (
    <Card className="space-y-3 border-accent/40">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-mono text-xl font-semibold">{item.symbol}</h3>
          <p className="text-xs text-muted">
            {item.name} · {item.assetType} · {item.boardQualityLabel ?? item.quality}
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      <p className="text-sm">{item.whyRanked}</p>
      <p className="text-xs text-muted">{item.newsSummary.newsTechnicalNote}</p>
      {item.missingConfirmation.length > 0 ? (
        <div>
          <p className="text-[11px] font-medium uppercase text-muted">What is missing</p>
          <ul className="mt-1 list-disc pl-4 text-xs text-muted">
            {item.missingConfirmation.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <p className="text-muted">Trend / Momentum</p>
          <p>
            {item.confirmationDetail?.trend ?? "—"} /{" "}
            {item.confirmationDetail?.momentum ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-muted">EMA / MACD</p>
          <p>
            {item.confirmationDetail?.ema ?? "—"} / {item.confirmationDetail?.macd ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-muted">Entry / Stop / TP</p>
          <p className="font-mono">
            {formatPrice(item.entry)} / {formatPrice(item.stop)} / {formatPrice(item.tp1)} /{" "}
            {formatPrice(item.tp2)}
          </p>
        </div>
        <div>
          <p className="text-muted">Freshness</p>
          <p>{item.dataQuality}</p>
        </div>
      </div>
      {item.news.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase text-muted">Most relevant news</p>
          {item.news.map((article) => (
            <div key={`${article.headline}-${article.publishedAt}`} className="rounded border p-2 text-xs">
              <p className="font-medium">{article.headline}</p>
              <p className="text-muted">
                {article.source ?? "Unknown"} · {article.category} · {article.sentiment} ·{" "}
                {article.publishedAt
                  ? new Date(article.publishedAt).toLocaleString()
                  : "—"}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">No relevant stored news for this symbol.</p>
      )}
    </Card>
  );
}

export function OpportunityScreener({ candidates }: { candidates: OpportunityCandidate[] }) {
  const [activeFilters, setActiveFilters] = useState<TableFilter[]>(["ALL"]);
  const [sortKey, setSortKey] = useState<TableSortKey>("default");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<OpportunityCandidate | null>(null);
  const pageSize = 25;

  const filtered = useMemo(() => {
    const ranked = candidates.map(candidateAsRanked);
    const filteredRows = filterCandidates(ranked, activeFilters, search);
    return sortCandidates(filteredRows, sortKey).map((row, index) => {
      const original = candidates.find((c) => c.symbol === row.symbol)!;
      return { ...original, rank: index + 1 };
    });
  }, [candidates, activeFilters, search, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);

  function toggleFilter(filter: TableFilter) {
    setPage(0);
    if (filter === "ALL") {
      setActiveFilters(["ALL"]);
      return;
    }
    setActiveFilters((current) => {
      const withoutAll = current.filter((f) => f !== "ALL");
      return withoutAll.includes(filter)
        ? withoutAll.filter((f) => f !== filter)
        : [...withoutAll, filter];
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Daily opportunity table</h2>
          <p className="text-[11px] text-muted">
            Stored scan results only — {filtered.length} rows match current filters
          </p>
        </div>
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
          placeholder="Search symbol"
          className="max-w-xs"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Button
            key={filter.id}
            variant={activeFilters.includes(filter.id) ? "primary" : "ghost"}
            onClick={() => toggleFilter(filter.id)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase text-muted">Sort</span>
        {SORTS.map((sort) => (
          <Button
            key={sort.id}
            variant={sortKey === sort.id ? "primary" : "ghost"}
            onClick={() => setSortKey(sort.id)}
          >
            {sort.label}
          </Button>
        ))}
      </div>

      {selected ? <DetailPanel item={selected} onClose={() => setSelected(null)} /> : null}

      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table className="min-w-[1100px] w-full text-left text-xs">
          <thead className="bg-surface/60 text-[10px] uppercase tracking-wide text-muted">
            <tr>
              {[
                "#",
                "Symbol",
                "Type",
                "Price",
                "Dir",
                "Quality",
                "Score",
                "Status",
                "Risk",
                "Entry",
                "Stop",
                "TP1",
                "TP2",
                "R:R",
                "News",
                "Fresh",
              ].map((col) => (
                <th key={col} className="px-2 py-2 font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={row.symbol}
                className="cursor-pointer border-t border-border/50 hover:bg-surface/40"
                onClick={() => setSelected(row)}
              >
                <td className="px-2 py-2 font-mono">{row.rank}</td>
                <td className="px-2 py-2 font-mono font-semibold">{row.symbol}</td>
                <td className="px-2 py-2">{row.assetType}</td>
                <td className="px-2 py-2 font-mono">{formatPrice(row.price)}</td>
                <td className="px-2 py-2">{row.direction}</td>
                <td className="px-2 py-2">
                  <Badge tone={boardTone(row.boardQuality)}>{row.boardQualityLabel ?? row.quality}</Badge>
                </td>
                <td className="px-2 py-2 font-mono">{row.opportunityScore.toFixed(0)}</td>
                <td className="px-2 py-2">{row.tradeStatus}</td>
                <td className="px-2 py-2">{row.riskLevel}</td>
                <td className="px-2 py-2 font-mono">{formatPrice(row.entry)}</td>
                <td className="px-2 py-2 font-mono">{formatPrice(row.stop)}</td>
                <td className="px-2 py-2 font-mono">{formatPrice(row.tp1)}</td>
                <td className="px-2 py-2 font-mono">{formatPrice(row.tp2)}</td>
                <td className="px-2 py-2 font-mono">
                  {row.riskReward ? row.riskReward.toFixed(2) : "—"}
                </td>
                <td className="px-2 py-2">
                  {row.newsSummary.impactLabel} · {row.newsSummary.sentimentLabel}
                </td>
                <td className="px-2 py-2">{row.dataQuality}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted">
          Page {page + 1} of {pageCount}
        </p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            Previous
          </Button>
          <Button
            variant="ghost"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
