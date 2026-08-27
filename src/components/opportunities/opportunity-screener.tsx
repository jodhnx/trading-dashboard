"use client";

import { memo, useMemo, useState } from "react";
import type { OpportunityCandidate } from "@/services/opportunity/present";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  filterCandidates,
  sortCandidates,
  type TableFilter,
  type TableSortKey,
} from "@/services/opportunity/table-utils";
import type { RankedOpportunity } from "@/services/opportunity/types";
import {
  collectSectors,
  formatOpportunityPrice,
  formatRiskPercent,
  freshnessBadgeLabel,
} from "@/services/opportunity/ui-utils";
import { CandidateDetailPanel } from "./candidate-detail-panel";

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
  { id: "NO_TRADE", label: "No trade" },
  { id: "DATA_SKIP", label: "Data skip" },
  { id: "LOW_RISK", label: "Low risk" },
  { id: "MEDIUM_RISK", label: "Medium risk" },
  { id: "HIGH_RISK", label: "High risk" },
  { id: "EXTREME_RISK", label: "Extreme risk" },
  { id: "LONG", label: "Long" },
  { id: "SHORT", label: "Short" },
  { id: "NEWS_POSITIVE", label: "Positive news" },
  { id: "NEWS_NEGATIVE", label: "Negative news" },
  { id: "NEWS_MIXED", label: "Mixed news" },
  { id: "HIGH_NEWS_IMPACT", label: "High news impact" },
  { id: "DISCOVERED", label: "Discovered today" },
  { id: "BREAKOUT", label: "Breakout" },
  { id: "UNUSUAL_VOLUME", label: "Unusual volume" },
];

const SORTS: Array<{ id: TableSortKey; label: string }> = [
  { id: "default", label: "Default rank" },
  { id: "score", label: "Opportunity score" },
  { id: "risk", label: "Risk" },
  { id: "riskReward", label: "Risk / reward" },
  { id: "newsImpact", label: "News impact" },
  { id: "newsRecency", label: "News recency" },
  { id: "discovery", label: "Discovery" },
  { id: "freshness", label: "Freshness" },
  { id: "symbol", label: "Symbol" },
];

function candidateAsRanked(item: OpportunityCandidate): RankedOpportunity & { sector?: string | null } {
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
    scores: { ...item.scores, weights: item.weights },
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
    sector: item.sector,
  };
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

const TableRow = memo(function TableRow({
  row,
  onSelect,
}: {
  row: OpportunityCandidate & { rank: number };
  onSelect: (item: OpportunityCandidate) => void;
}) {
  return (
    <tr
      className="cursor-pointer border-t border-border/50 hover:bg-surface/40"
      onClick={() => onSelect(row)}
    >
      <td className="px-2 py-2 font-mono">{row.rank}</td>
      <td className="px-2 py-2 font-mono font-semibold">{row.symbol}</td>
      <td className="hidden px-2 py-2 lg:table-cell">{row.name}</td>
      <td className="px-2 py-2">{row.assetType}</td>
      <td className="hidden px-2 py-2 xl:table-cell">{row.sector ?? "—"}</td>
      <td className="px-2 py-2 font-mono">{formatOpportunityPrice(row.price)}</td>
      <td className="px-2 py-2">{row.direction}</td>
      <td className="px-2 py-2 text-[11px]">{row.aiView.label}</td>
      <td className="px-2 py-2">
        <Badge tone={boardTone(row.boardQuality)}>{row.boardQualityLabel ?? row.quality}</Badge>
      </td>
      <td className="px-2 py-2 font-mono">{row.opportunityScore.toFixed(0)}</td>
      <td className="px-2 py-2">{row.riskLevel}</td>
      <td className="hidden px-2 py-2 font-mono md:table-cell">
        {formatRiskPercent(row.recommendedRiskPercent)}
      </td>
      <td className="hidden px-2 py-2 font-mono sm:table-cell">
        {formatOpportunityPrice(row.entry)}
      </td>
      <td className="hidden px-2 py-2 font-mono md:table-cell">
        {formatOpportunityPrice(row.stop)}
      </td>
      <td className="hidden px-2 py-2 font-mono lg:table-cell">
        {formatOpportunityPrice(row.tp1)}
      </td>
      <td className="hidden px-2 py-2 font-mono lg:table-cell">
        {formatOpportunityPrice(row.tp2)}
      </td>
      <td className="hidden px-2 py-2 font-mono md:table-cell">
        {row.riskReward ? row.riskReward.toFixed(2) : "—"}
      </td>
      <td className="hidden px-2 py-2 xl:table-cell">
        {row.newsSummary.impactLabel}
      </td>
      <td className="hidden px-2 py-2 xl:table-cell">
        {row.newsSummary.catalyst ?? "—"}
      </td>
      <td className="hidden px-2 py-2 xl:table-cell text-[11px]">
        {row.aiResearch && !row.aiResearch.unavailable
          ? row.aiResearch.action.replace(/_/g, " ")
          : row.aiView.source === "ai"
            ? "AI"
            : "Deterministic"}
      </td>
      <td className="px-2 py-2">{freshnessBadgeLabel(row.dataQuality)}</td>
    </tr>
  );
});

export function OpportunityScreener({ candidates }: { candidates: OpportunityCandidate[] }) {
  const [activeFilters, setActiveFilters] = useState<TableFilter[]>(["ALL"]);
  const [sortKey, setSortKey] = useState<TableSortKey>("default");
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<OpportunityCandidate | null>(null);

  const sectors = useMemo(
    () => collectSectors(candidates.map(candidateAsRanked)),
    [candidates],
  );

  const filtered = useMemo(() => {
    const ranked = candidates.map(candidateAsRanked);
    const filteredRows = filterCandidates(
      ranked,
      activeFilters,
      search,
      sector || null,
    );
    return sortCandidates(filteredRows, sortKey).map((row, index) => {
      const original = candidates.find((c) => c.symbol === row.symbol)!;
      return { ...original, rank: index + 1 };
    });
  }, [candidates, activeFilters, search, sortKey, sector]);

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

  function resetFilters() {
    setActiveFilters(["ALL"]);
    setSearch("");
    setSector("");
    setSortKey("default");
    setPage(0);
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Opportunity research table</h2>
          <p className="text-[11px] text-muted">
            Stored scan only — {filtered.length} rows match · up to {candidates.length} loaded
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Search symbol or name"
            className="max-w-xs"
          />
          <select
            value={sector}
            onChange={(event) => {
              setSector(event.target.value);
              setPage(0);
            }}
            className="h-10 rounded-md border border-border bg-surface px-3 text-xs"
          >
            <option value="">All sectors</option>
            {sectors.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <Button variant="ghost" onClick={resetFilters}>
            Reset filters
          </Button>
        </div>
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
        <span className="ml-auto text-[11px] uppercase text-muted">Rows</span>
        {[25, 50].map((size) => (
          <Button
            key={size}
            variant={pageSize === size ? "primary" : "ghost"}
            onClick={() => {
              setPageSize(size);
              setPage(0);
            }}
          >
            {size}
          </Button>
        ))}
      </div>

      {selected ? (
        <CandidateDetailPanel item={selected} onClose={() => setSelected(null)} />
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table className="min-w-[1400px] w-full text-left text-xs">
          <thead className="bg-surface/60 text-[10px] uppercase tracking-wide text-muted">
            <tr>
              {[
                "Rank",
                "Symbol",
                "Name",
                "Type",
                "Sector",
                "Price",
                "Direction",
                "Action",
                "Quality",
                "Score",
                "Risk",
                "Risk %",
                "Entry",
                "Stop",
                "TP1",
                "TP2",
                "R:R",
                "News",
                "Catalyst",
                "AI View",
                "Freshness",
              ].map((col) => (
                <th key={col} className="px-2 py-2 font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <TableRow key={row.symbol} row={row} onSelect={setSelected} />
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
