"use client";

import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { EquityCurveChart } from "@/components/backtest/equity-curve-chart";
import { MARKET_WATCHLIST } from "@/services/market/symbols";
import type {
  BacktestResult,
  BacktestTrade,
  BacktestWorkspaceSnapshot,
} from "@/services/backtest/types";
import {
  dataStatusTone,
  defaultBacktestRange,
  exitReasonLabel,
  formatBacktestDate,
  formatBacktestMoney,
  formatBacktestPercent,
  formatBacktestRatio,
  pnlClass,
} from "@/services/backtest/view-model";
import { TIMEFRAMES } from "@/types/enums";

type Props = {
  initial: BacktestWorkspaceSnapshot;
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

function StatusBadge({ status }: { status: BacktestResult["dataStatus"] }) {
  const tone = dataStatusTone(status);
  return (
    <Badge tone={tone === "positive" ? "positive" : tone === "warning" ? "warning" : tone === "negative" ? "negative" : "neutral"}>
      {status}
    </Badge>
  );
}

export function BacktestingWorkspace({ initial }: Props) {
  const defaults = defaultBacktestRange();
  const [riskSettings] = useState(initial.riskSettings);
  const [symbol, setSymbol] = useState("NVDA");
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>("1day");
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [startingCapital, setStartingCapital] = useState("10000");
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<BacktestTrade | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onRunBacktest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSelectedTrade(null);
    try {
      const response = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          timeframe,
          from,
          to,
          startingCapital: Number(startingCapital),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        result?: BacktestResult;
        error?: string;
      } | null;
      if (!response.ok || !payload?.result) {
        setError(payload?.error ?? "Backtest failed.");
        setResult(null);
        return;
      }
      setResult(payload.result);
    } catch {
      setError("Backtest failed.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="space-y-3 border-b border-border pb-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Backtesting
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            Historical simulation of the existing Trading Engine.
          </h2>
          <p className="mt-2 text-sm text-warning">
            Simulation only. Historical results are not guarantees of future performance.
          </p>
        </div>
      </header>

      <Card className="space-y-4">
        <CardTitle>Configuration</CardTitle>
        <form className="grid gap-4 lg:grid-cols-2" onSubmit={onRunBacktest}>
          <div className="space-y-2">
            <Label htmlFor="bt-symbol">Asset</Label>
            <Select
              id="bt-symbol"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
            >
              {MARKET_WATCHLIST.filter((asset) => asset.providerSymbol).map(
                (asset) => (
                  <option key={asset.symbol} value={asset.symbol}>
                    {asset.symbol} — {asset.name}
                  </option>
                ),
              )}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bt-timeframe">Timeframe</Label>
            <Select
              id="bt-timeframe"
              value={timeframe}
              onChange={(event) =>
                setTimeframe(event.target.value as (typeof TIMEFRAMES)[number])
              }
            >
              {TIMEFRAMES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bt-from">Start date</Label>
            <Input
              id="bt-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bt-to">End date</Label>
            <Input
              id="bt-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bt-capital">Starting capital</Label>
            <Input
              id="bt-capital"
              type="number"
              min={100}
              step="100"
              value={startingCapital}
              onChange={(event) => setStartingCapital(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <p className="text-[11px] uppercase tracking-wide text-muted">
              Risk settings (read-only)
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Metric
                label="Risk per trade"
                value={`${riskSettings.riskPerTradePercent}%`}
              />
              <Metric
                label="Max position exposure"
                value={`${riskSettings.maxPositionPercent}%`}
              />
              <Metric
                label="Minimum R:R"
                value={formatBacktestRatio(riskSettings.minimumRiskReward)}
              />
            </div>
          </div>
          <div className="lg:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Running…" : "Run Backtest"}
            </Button>
          </div>
        </form>
        <p className="text-xs text-muted">
          Fees/slippage not modeled. Results reflect the existing Trading Engine rules only.
        </p>
      </Card>

      {error ? <ErrorState title="Backtest error" description={error} /> : null}

      {result ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={result.dataStatus} />
            {result.dataStatus === "MOCK" ? (
              <p className="text-sm text-warning">
                MOCK data — not real historical performance.
              </p>
            ) : null}
            {result.dataStatus === "STALE" ? (
              <p className="text-sm text-warning">Stale data — interpret with caution.</p>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Starting Capital"
              value={formatBacktestMoney(result.startingCapital)}
            />
            <Metric
              label="Ending Capital"
              value={formatBacktestMoney(result.endingCapital)}
            />
            <Metric
              label="Total Return"
              value={formatBacktestPercent(result.totalReturn * 100)}
              hint="Historical descriptive metric only."
            />
            <Metric
              label="Total P&amp;L"
              value={formatBacktestMoney(result.totalPnL)}
            />
            <Metric label="Total Trades" value={String(result.totalTrades)} />
            <Metric
              label="Win Rate"
              value={
                result.winRate === null
                  ? "—"
                  : `${(result.winRate * 100).toFixed(1)}%`
              }
              hint="Historical descriptive metric only — not a prediction."
            />
            <Metric
              label="Max Drawdown"
              value={formatBacktestPercent(result.maxDrawdown * 100)}
            />
            <Metric
              label="Profit Factor"
              value={formatBacktestRatio(result.profitFactor)}
            />
          </div>

          <Card className="space-y-3">
            <CardTitle>Equity Curve</CardTitle>
            <EquityCurveChart points={result.equityCurve} />
          </Card>

          <Card className="space-y-3">
            <CardTitle>Trade History</CardTitle>
            {result.trades.length === 0 ? (
              <EmptyState
                title="NO TRADES"
                description="The Trading Engine did not produce valid setups in this range."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Asset</th>
                      <th className="px-3 py-2">Side</th>
                      <th className="px-3 py-2">Entry</th>
                      <th className="px-3 py-2">Exit</th>
                      <th className="px-3 py-2">P&amp;L</th>
                      <th className="px-3 py-2">P&amp;L %</th>
                      <th className="px-3 py-2">Score</th>
                      <th className="px-3 py-2">Exit Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((trade) => (
                      <tr
                        key={trade.id}
                        className="cursor-pointer border-b border-border/60 hover:bg-surface-2"
                        onClick={() => setSelectedTrade(trade)}
                      >
                        <td className="px-3 py-2 font-mono text-xs">
                          {formatBacktestDate(trade.exitTime)}
                        </td>
                        <td className="px-3 py-2">{result.symbol}</td>
                        <td className="px-3 py-2">
                          <Badge tone={trade.side === "LONG" ? "positive" : "negative"}>
                            {trade.side}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {formatBacktestMoney(trade.entryPrice)}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {formatBacktestMoney(trade.exitPrice)}
                        </td>
                        <td className={`px-3 py-2 ${pnlClass(trade.realizedPnL)}`}>
                          {formatBacktestMoney(trade.realizedPnL)}
                        </td>
                        <td className={`px-3 py-2 ${pnlClass(trade.realizedPnLPercent)}`}>
                          {formatBacktestPercent(trade.realizedPnLPercent)}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {trade.setupScore ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {exitReasonLabel(trade.exitReason)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {selectedTrade ? (
            <Card className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Trade Detail — {selectedTrade.id}</CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSelectedTrade(null)}
                >
                  Close
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Detail label="Side" value={selectedTrade.side} />
                <Detail
                  label="Entry"
                  value={formatBacktestMoney(selectedTrade.entryPrice)}
                />
                <Detail
                  label="Exit"
                  value={formatBacktestMoney(selectedTrade.exitPrice)}
                />
                <Detail
                  label="Stop"
                  value={formatBacktestMoney(selectedTrade.stopLoss)}
                />
                <Detail
                  label="Target"
                  value={formatBacktestMoney(selectedTrade.takeProfit)}
                />
                <Detail
                  label="Quantity"
                  value={selectedTrade.quantity.toFixed(4)}
                />
                <Detail
                  label="Risk"
                  value={formatBacktestMoney(selectedTrade.riskAmount)}
                />
                <Detail
                  label="Score"
                  value={
                    selectedTrade.setupScore === null
                      ? "Unavailable"
                      : String(selectedTrade.setupScore)
                  }
                />
                <Detail
                  label="Technical"
                  value={selectedTrade.technicalCondition}
                />
                <Detail
                  label="Decision"
                  value={formatBacktestDate(selectedTrade.decisionTime)}
                />
                <Detail
                  label="Entry time"
                  value={formatBacktestDate(selectedTrade.entryTime)}
                />
                <Detail
                  label="Exit time"
                  value={formatBacktestDate(selectedTrade.exitTime)}
                />
                <Detail
                  label="Exit reason"
                  value={exitReasonLabel(selectedTrade.exitReason)}
                />
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono text-sm">{value}</p>
    </div>
  );
}
