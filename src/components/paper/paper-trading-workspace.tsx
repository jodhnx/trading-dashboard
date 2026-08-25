"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import type { PaperAccountSnapshot } from "@/services/paper/types";
import {
  accountHasUnavailablePrices,
  formatPaperMoney,
  formatPaperPercent,
  formatPaperQuantity,
  pnlClass,
} from "@/services/paper/view-model";

type Props = {
  initial: PaperAccountSnapshot;
  journalLinks?: Record<string, string>;
};

function StatusDot({ status }: { status: string }) {
  const tone =
    status === "LIVE"
      ? "bg-positive"
      : status === "CACHED"
        ? "bg-accent"
        : status === "STALE" || status === "MOCK" || status === "MIXED"
          ? "bg-warning"
          : "bg-negative";
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${tone}`} aria-hidden />
      {status === "DATA_UNAVAILABLE" ? "UNAVAILABLE" : status}
    </span>
  );
}

export function PaperTradingWorkspace({ initial, journalLinks = {} }: Props) {
  const [account, setAccount] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onClose(positionId: string) {
    const confirmed = window.confirm(
      "Close this paper position at the current market price?",
    );
    if (!confirmed) return;

    setBusyId(positionId);
    setFeedback(null);
    setError(null);
    try {
      const response = await fetch(`/api/paper/positions/${positionId}/close`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        account?: PaperAccountSnapshot;
        error?: string;
      } | null;
      if (!response.ok || !payload?.account) {
        setError(payload?.error ?? "Position could not be closed.");
        return;
      }
      setAccount(payload.account);
      setFeedback("Position closed.");
    } catch {
      setError("Position could not be closed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <header className="space-y-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              Paper Trading
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              Simulated Account
            </h2>
          </div>
          <Badge tone="warning">SIMULATION ONLY — NO REAL ORDERS</Badge>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Total Equity" value={formatPaperMoney(account.equity)} />
          <Metric label="Cash" value={formatPaperMoney(account.cashBalance)} />
          <Metric
            label="Invested"
            value={formatPaperMoney(account.invested)}
          />
          <Metric
            label="Unrealized P&L"
            value={formatPaperMoney(account.unrealizedPnL, { signed: true })}
            valueClass={pnlClass(account.unrealizedPnL)}
          />
          <Metric
            label="Realized P&L"
            value={formatPaperMoney(account.realizedPnL, { signed: true })}
            valueClass={pnlClass(account.realizedPnL)}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Metric
            label="Starting Balance"
            value={formatPaperMoney(account.startingBalance)}
          />
          <Metric
            label="Open Positions"
            value={String(account.openPositions.length)}
          />
          <div className="rounded-md border border-border bg-surface px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted">
              Market Data
            </p>
            <p className="mt-1">
              <StatusDot status={account.dataStatus} />
            </p>
          </div>
        </div>
      </header>

      {feedback ? (
        <p className="text-sm text-positive" role="status">
          {feedback}
        </p>
      ) : null}
      {error ? <ErrorState title="Error" description={error} /> : null}

      {accountHasUnavailablePrices(account) ? (
        <ErrorState
          title="MARKET DATA UNAVAILABLE"
          description="Some open positions cannot be marked to market. Values stay Unavailable."
        />
      ) : null}

      <section className="space-y-3">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Open Positions
        </h3>
        {account.openPositions.length === 0 ? (
          <EmptyState
            title="NO OPEN POSITIONS"
            description="Open a paper trade from a valid Trading Setup on a market symbol page."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Asset</th>
                  <th className="px-3 py-2 font-medium">Side</th>
                  <th className="px-3 py-2 font-medium">Quantity</th>
                  <th className="px-3 py-2 font-medium">Entry</th>
                  <th className="px-3 py-2 font-medium">Current</th>
                  <th className="px-3 py-2 font-medium">Stop</th>
                  <th className="px-3 py-2 font-medium">Target</th>
                  <th className="px-3 py-2 font-medium">Market Value</th>
                  <th className="px-3 py-2 font-medium">Unrealized P&L</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {account.openPositions.map((position) => (
                  <tr
                    key={position.id}
                    className="border-b border-border/70 last:border-0"
                  >
                    <td className="px-3 py-2 font-medium">{position.symbol}</td>
                    <td className="px-3 py-2">{position.side}</td>
                    <td className="px-3 py-2 font-mono">
                      {formatPaperQuantity(position.quantity)}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {formatPaperMoney(position.entryPrice)}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {position.currentPrice === null
                        ? "Unavailable"
                        : formatPaperMoney(position.currentPrice)}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {position.stopLoss === null
                        ? "—"
                        : formatPaperMoney(position.stopLoss)}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {position.takeProfit === null
                        ? "—"
                        : formatPaperMoney(position.takeProfit)}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {formatPaperMoney(position.marketValue)}
                    </td>
                    <td className={pnlClass(position.unrealizedPnL)}>
                      {formatPaperMoney(position.unrealizedPnL, { signed: true })}
                    </td>
                    <td className="px-3 py-2">
                      <StatusDot status={position.dataStatus} />
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 px-2 text-xs"
                        disabled={busyId === position.id}
                        onClick={() => void onClose(position.id)}
                      >
                        Close
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Trade History
        </h3>
        {account.closedTrades.length === 0 ? (
          <EmptyState
            title="NO CLOSED TRADES"
            description="Closed paper trades will appear here."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Asset</th>
                  <th className="px-3 py-2 font-medium">Side</th>
                  <th className="px-3 py-2 font-medium">Quantity</th>
                  <th className="px-3 py-2 font-medium">Entry</th>
                  <th className="px-3 py-2 font-medium">Exit</th>
                  <th className="px-3 py-2 font-medium">P&L</th>
                  <th className="px-3 py-2 font-medium">P&L %</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Journal</th>
                </tr>
              </thead>
              <tbody>
                {account.closedTrades.map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-b border-border/70 last:border-0"
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {trade.closedAt
                        ? new Date(trade.closedAt).toLocaleString("en-GB")
                        : "—"}
                    </td>
                    <td className="px-3 py-2 font-medium">{trade.symbol}</td>
                    <td className="px-3 py-2">{trade.side}</td>
                    <td className="px-3 py-2 font-mono">
                      {formatPaperQuantity(trade.quantity)}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {formatPaperMoney(trade.entryPrice)}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {formatPaperMoney(trade.exitPrice)}
                    </td>
                    <td className={pnlClass(trade.realizedPnL)}>
                      {formatPaperMoney(trade.realizedPnL, { signed: true })}
                    </td>
                    <td className={pnlClass(trade.realizedPnLPercent)}>
                      {formatPaperPercent(trade.realizedPnLPercent, {
                        signed: true,
                      })}
                    </td>
                    <td className="px-3 py-2">{trade.closeReason ?? "—"}</td>
                    <td className="px-3 py-2">{trade.status}</td>
                    <td className="px-3 py-2">
                      {journalLinks[trade.id] ? (
                        <Link
                          href={`/journal?entry=${journalLinks[trade.id]}`}
                          className="text-xs text-accent hover:underline"
                        >
                          Journaled
                        </Link>
                      ) : (
                        <Link
                          href={`/journal?paperTradeId=${trade.id}`}
                          className="text-xs text-accent hover:underline"
                        >
                          Review Trade
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-mono text-sm font-medium ${valueClass ?? ""}`}>
        {value}
      </p>
    </div>
  );
}
