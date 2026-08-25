"use client";

import { useState } from "react";
import { PaperEquityChart } from "@/components/analytics/paper-equity-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { ANALYTICS_PRESETS, ANALYTICS_SYMBOLS } from "@/services/analytics/constants";
import type { AnalyticsPreset, AnalyticsViewModel } from "@/services/analytics/types";
import {
  exitReasonLabel,
  formatAnalyticsDate,
  formatAnalyticsMoney,
  formatAnalyticsPercent,
  formatAnalyticsRatio,
  pnlClass,
  presetLabel,
  winRateLabel,
} from "@/services/analytics/view-model";

type Props = {
  initial: AnalyticsViewModel;
};

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono text-sm">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function AnalyticsWorkspace({ initial }: Props) {
  const [view, setView] = useState(initial);
  const [preset, setPreset] = useState<AnalyticsPreset>(
    initial.filters.preset === "CUSTOM" ? "ALL" : initial.filters.preset,
  );
  const [symbol, setSymbol] = useState(initial.filters.symbol);
  const [from, setFrom] = useState(initial.filters.from ?? "");
  const [to, setTo] = useState(initial.filters.to ?? "");
  const [useCustomRange, setUseCustomRange] = useState(
    initial.filters.preset === "CUSTOM",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function applyFilters() {
    setBusy(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("dataset", "all");
    if (useCustomRange) {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    } else if (preset !== "ALL") {
      params.set("preset", preset);
    }
    if (symbol !== "ALL") {
      params.set("symbol", symbol);
    }
    try {
      const response = await fetch(`/api/analytics?${params.toString()}`);
      const payload = (await response.json().catch(() => null)) as
        | AnalyticsViewModel
        | { error?: string }
        | null;
      if (!response.ok || !payload || !("paper" in payload)) {
        setError((payload as { error?: string } | null)?.error ?? "Unable to load analytics.");
        return;
      }
      setView(payload);
    } catch {
      setError("Unable to load analytics.");
    } finally {
      setBusy(false);
    }
  }

  const paper = view.paper;
  const journal = view.journal;
  const backtest = view.backtest;

  return (
    <div className="space-y-4">
      <header className="space-y-3 border-b border-border pb-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Analytics
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            Historical performance of your simulated trading activity.
          </h2>
          <p className="mt-2 text-sm text-warning">
            Historical results are descriptive and do not guarantee future performance.
          </p>
        </div>
      </header>

      <Card className="space-y-4">
        <CardTitle>Filters</CardTitle>
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="analytics-preset">Date range</Label>
            <Select
              id="analytics-preset"
              value={useCustomRange ? "CUSTOM" : preset}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "CUSTOM") {
                  setUseCustomRange(true);
                } else {
                  setUseCustomRange(false);
                  setPreset(value as AnalyticsPreset);
                }
              }}
            >
              {ANALYTICS_PRESETS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
              <option value="CUSTOM">Custom</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="analytics-symbol">Asset</Label>
            <Select
              id="analytics-symbol"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
            >
              {ANALYTICS_SYMBOLS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
          {useCustomRange ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="analytics-from">From</Label>
                <Input
                  id="analytics-from"
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="analytics-to">To</Label>
                <Input
                  id="analytics-to"
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </div>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => void applyFilters()} disabled={busy}>
            {busy ? "Applying…" : "Apply Filters"}
          </Button>
          <span className="text-xs text-muted">
            Active: {presetLabel(view.filters.preset)}
            {view.filters.symbol !== "ALL" ? ` · ${view.filters.symbol}` : ""}
          </span>
        </div>
      </Card>

      {error ? <ErrorState title="Analytics error" description={error} /> : null}

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Paper Trading Performance</h3>
          <p className="text-xs text-muted">Closed paper trades and stored account values only.</p>
        </div>

        {!paper.hasData ? (
          <EmptyState
            title="NO PAPER TRADING DATA YET"
            description="No closed paper trades are available for analysis."
          />
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Metric
                label="Total Return"
                value={formatAnalyticsPercent(paper.summary.totalReturn)}
                hint="Historical descriptive metric only."
              />
              <Metric
                label="Realized P&L"
                value={formatAnalyticsMoney(paper.summary.realizedPnL)}
              />
              <Metric
                label="Unrealized P&L"
                value={formatAnalyticsMoney(paper.summary.unrealizedPnL)}
              />
              <Metric
                label="Win Rate"
                value={winRateLabel(paper.summary.winRate)}
                hint="Historical descriptive metric only — not a prediction."
              />
              <Metric
                label="Profit Factor"
                value={formatAnalyticsRatio(paper.summary.profitFactor)}
              />
              <Metric
                label="Max Drawdown"
                value={formatAnalyticsPercent(paper.summary.maxDrawdown)}
              />
            </div>

            <Card className="space-y-3">
              <CardTitle>Paper Equity</CardTitle>
              <p className="text-xs text-muted">
                Realized closed-trade equity curve from stored paper trade P&amp;L.
              </p>
              <PaperEquityChart points={paper.equityCurve} />
            </Card>

            <Card className="space-y-3">
              <CardTitle>Performance by Asset</CardTitle>
              <AnalyticsTable
                headers={[
                  "Asset",
                  "Trades",
                  "Wins",
                  "Losses",
                  "Win Rate",
                  "Realized P&L",
                  "Avg Trade",
                ]}
                rows={paper.byAsset.map((row) => [
                  row.symbol,
                  String(row.trades),
                  String(row.wins),
                  String(row.losses),
                  winRateLabel(row.winRate),
                  formatAnalyticsMoney(row.totalPnL),
                  formatAnalyticsMoney(row.averagePnL),
                ])}
              />
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="space-y-3">
                <CardTitle>Long vs Short</CardTitle>
                <AnalyticsTable
                  headers={["Side", "Trades", "Win Rate", "P&L", "Avg P&L"]}
                  rows={paper.bySide.map((row) => [
                    row.side,
                    String(row.trades),
                    winRateLabel(row.winRate),
                    formatAnalyticsMoney(row.totalPnL),
                    formatAnalyticsMoney(row.averagePnL),
                  ])}
                />
              </Card>

              <Card className="space-y-3">
                <CardTitle>Exit Analysis</CardTitle>
                <AnalyticsTable
                  headers={["Exit Reason", "Trades", "P&L", "Avg P&L"]}
                  rows={paper.byExitReason.map((row) => [
                    exitReasonLabel(row.reason),
                    String(row.count),
                    formatAnalyticsMoney(row.totalPnL),
                    formatAnalyticsMoney(row.averagePnL),
                  ])}
                />
              </Card>
            </div>

            <Card className="space-y-3">
              <CardTitle>Setup Score Analysis</CardTitle>
              <p className="text-xs text-muted">
                Historical score buckets from stored paper trades — not probabilities of future success.
              </p>
              <AnalyticsTable
                headers={["Score", "Trades", "Win Rate", "P&L", "Avg P&L"]}
                rows={paper.byScore.map((row) => [
                  row.insufficientData ? `${row.bucket} (Insufficient data)` : row.bucket,
                  String(row.trades),
                  winRateLabel(row.winRate),
                  formatAnalyticsMoney(row.totalPnL),
                  formatAnalyticsMoney(row.averagePnL),
                ])}
              />
            </Card>
          </>
        )}
      </section>

      <section className="space-y-4 border-t border-border pt-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Journal Insights</h3>
          <p className="text-xs text-muted">Historical journal grouping — not causation.</p>
        </div>

        {!journal.hasData ? (
          <EmptyState title="NO JOURNAL DATA YET" description="No journal entries match the current filters." />
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Journal Entries" value={String(journal.totalEntries)} />
              <Metric label="Reviewed Trades" value={String(journal.reviewedTrades)} />
              <Metric
                label="Avg Setup Rating"
                value={formatAnalyticsRatio(journal.averageSetupRating)}
              />
              <Metric
                label="Avg Execution Rating"
                value={formatAnalyticsRatio(journal.averageExecutionRating)}
              />
              <Metric
                label="Avg Discipline Rating"
                value={formatAnalyticsRatio(journal.averageDisciplineRating)}
              />
              <Metric
                label="Most Common Mistake"
                value={journal.mostCommonMistake ?? "—"}
              />
              <Metric
                label="Most Common Emotion"
                value={journal.mostCommonEmotionalState ?? "—"}
              />
              <Metric
                label="Top Tags"
                value={
                  journal.topTags.length === 0
                    ? "—"
                    : journal.topTags.map((item) => item.tag).join(", ")
                }
              />
            </div>

            {journal.ratingGroups.length > 0 ? (
              <Card className="space-y-3">
                <CardTitle>Historical Journal Grouping by Setup Rating</CardTitle>
                <AnalyticsTable
                  headers={["Setup Rating", "Reviewed Trades", "Total Realized P&L"]}
                  rows={journal.ratingGroups.map((row) => [
                    String(row.setupRating),
                    String(row.trades),
                    formatAnalyticsMoney(row.totalRealizedPnL),
                  ])}
                />
              </Card>
            ) : null}
          </>
        )}
      </section>

      <section className="space-y-4 border-t border-border pt-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Backtest Performance</h3>
          <p className="text-xs text-muted">Simulated historical backtests — separate from paper trading.</p>
        </div>

        {!backtest.hasSavedResults ? (
          <EmptyState
            title="NO SAVED BACKTEST RESULTS"
            description="Run and save backtests to compare simulated historical performance here."
          />
        ) : (
          <Card className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge tone="warning">SIMULATED HISTORICAL BACKTEST</Badge>
            </div>
            <AnalyticsTable
              headers={[
                "Asset",
                "Range",
                "Total Return",
                "Trades",
                "Win Rate",
                "Max Drawdown",
                "Profit Factor",
              ]}
              rows={backtest.runs.map((run) => [
                run.symbol ?? "—",
                `${formatAnalyticsDate(run.from)} – ${formatAnalyticsDate(run.to)}`,
                formatAnalyticsPercent(run.totalReturn),
                run.totalTrades === null ? "—" : String(run.totalTrades),
                winRateLabel(run.winRate),
                formatAnalyticsPercent(run.maxDrawdown),
                formatAnalyticsRatio(run.profitFactor),
              ])}
            />
          </Card>
        )}
      </section>
    </div>
  );
}

function AnalyticsTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No data for the current filters.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wide text-muted">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border/60">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`px-3 py-2 ${cellIndex >= 4 ? pnlClass(Number(cell.replace(/[^0-9.-]/g, ""))) : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
