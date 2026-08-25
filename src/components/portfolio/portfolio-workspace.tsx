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
import { MARKET_WATCHLIST } from "@/services/market/symbols";
import type { PortfolioSnapshot, ValuedHolding } from "@/services/portfolio/types";
import {
  formatPortfolioMoney,
  formatPortfolioPercent,
  formatPortfolioQuantity,
} from "@/services/portfolio/view-model";

type Props = {
  initial: PortfolioSnapshot;
};

type Feedback = { tone: "ok" | "error"; message: string } | null;

function statusTone(
  status: ValuedHolding["dataStatus"] | PortfolioSnapshot["dataStatus"],
): "positive" | "accent" | "warning" | "negative" | "neutral" {
  if (status === "LIVE") return "positive";
  if (status === "CACHED") return "accent";
  if (status === "MOCK" || status === "STALE" || status === "MIXED") {
    return "warning";
  }
  if (status === "UNAVAILABLE" || status === "DATA_UNAVAILABLE") {
    return "negative";
  }
  return "neutral";
}

function StatusDot({
  status,
}: {
  status: ValuedHolding["dataStatus"] | PortfolioSnapshot["dataStatus"];
}) {
  const label =
    status === "DATA_UNAVAILABLE" ? "UNAVAILABLE" : String(status);
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-muted">
      <span
        className={
          status === "LIVE"
            ? "h-1.5 w-1.5 rounded-full bg-positive"
            : status === "CACHED"
              ? "h-1.5 w-1.5 rounded-full bg-accent"
              : status === "STALE" || status === "MOCK" || status === "MIXED"
                ? "h-1.5 w-1.5 rounded-full bg-warning"
                : "h-1.5 w-1.5 rounded-full bg-negative"
        }
        aria-hidden
      />
      {label}
    </span>
  );
}

function pnlClass(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value === 0) {
    return "font-mono text-sm";
  }
  return value > 0
    ? "font-mono text-sm text-positive"
    : "font-mono text-sm text-negative";
}

async function readPortfolioResponse(
  response: Response,
): Promise<{ portfolio?: PortfolioSnapshot; error?: string; code?: string }> {
  return (await response.json().catch(() => ({}))) as {
    portfolio?: PortfolioSnapshot;
    error?: string;
    code?: string;
  };
}

export function PortfolioWorkspace({ initial }: Props) {
  const [portfolio, setPortfolio] = useState(initial);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editEntry, setEditEntry] = useState("");
  const [cashDraft, setCashDraft] = useState(String(initial.cash));
  const currency = portfolio.currency || "EUR";

  function applyPortfolio(next: PortfolioSnapshot, message: string) {
    setPortfolio(next);
    setCashDraft(String(next.cash));
    setFeedback({ tone: "ok", message });
  }

  async function onAddHolding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    const form = new FormData(event.currentTarget);
    const body = {
      symbol: String(form.get("symbol") ?? ""),
      quantity: form.get("quantity"),
      averageEntryPrice: form.get("averageEntryPrice"),
    };

    try {
      const response = await fetch("/api/portfolio/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await readPortfolioResponse(response);
      if (!response.ok || !payload.portfolio) {
        setFeedback({
          tone: "error",
          message: payload.error ?? "Holding could not be added.",
        });
        return;
      }
      applyPortfolio(payload.portfolio, "Holding added.");
      event.currentTarget.reset();
    } catch {
      setFeedback({ tone: "error", message: "Holding could not be added." });
    } finally {
      setBusy(false);
    }
  }

  async function onSaveCash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cash: cashDraft }),
      });
      const payload = await readPortfolioResponse(response);
      if (!response.ok || !payload.portfolio) {
        setFeedback({
          tone: "error",
          message: payload.error ?? "Cash could not be updated.",
        });
        return;
      }
      applyPortfolio(payload.portfolio, "Cash updated.");
    } catch {
      setFeedback({ tone: "error", message: "Cash could not be updated." });
    } finally {
      setBusy(false);
    }
  }

  function startEdit(holding: ValuedHolding) {
    setEditingId(holding.id);
    setEditQuantity(String(holding.quantity));
    setEditEntry(String(holding.averageEntryPrice));
    setFeedback(null);
  }

  async function onSaveEdit(holdingId: string) {
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/portfolio/holdings/${holdingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: editQuantity,
          averageEntryPrice: editEntry,
        }),
      });
      const payload = await readPortfolioResponse(response);
      if (!response.ok || !payload.portfolio) {
        setFeedback({
          tone: "error",
          message: payload.error ?? "Holding could not be updated.",
        });
        return;
      }
      setEditingId(null);
      applyPortfolio(payload.portfolio, "Holding updated.");
    } catch {
      setFeedback({ tone: "error", message: "Holding could not be updated." });
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(holding: ValuedHolding) {
    const confirmed = window.confirm(
      `Delete holding ${holding.symbol}? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/portfolio/holdings/${holding.id}`, {
        method: "DELETE",
      });
      const payload = await readPortfolioResponse(response);
      if (!response.ok || !payload.portfolio) {
        setFeedback({
          tone: "error",
          message: payload.error ?? "Holding could not be deleted.",
        });
        return;
      }
      if (editingId === holding.id) {
        setEditingId(null);
      }
      applyPortfolio(payload.portfolio, "Holding deleted.");
    } catch {
      setFeedback({ tone: "error", message: "Holding could not be deleted." });
    } finally {
      setBusy(false);
    }
  }

  const unavailableHoldings = portfolio.holdings.filter(
    (item) => item.currentPrice === null,
  );

  return (
    <div className="space-y-4">
      <header className="space-y-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              Portfolio
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              Holdings &amp; cash
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-muted">
              Market Data
            </span>
            <StatusDot status={portfolio.dataStatus} />
            <Badge tone={statusTone(portfolio.dataStatus)}>
              {portfolio.dataStatus === "DATA_UNAVAILABLE"
                ? "UNAVAILABLE"
                : portfolio.dataStatus}
            </Badge>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Total Value"
            value={formatPortfolioMoney(portfolio.totalPortfolioValue, currency)}
          />
          <Metric
            label="Invested"
            value={formatPortfolioMoney(portfolio.totalInvested, currency)}
          />
          <Metric
            label="Cash"
            value={formatPortfolioMoney(portfolio.cash, currency)}
          />
          <Metric
            label="Unrealized P&L"
            value={formatPortfolioMoney(portfolio.unrealizedPnL, currency, {
              signed: true,
            })}
            valueClass={pnlClass(portfolio.unrealizedPnL)}
          />
        </div>
        <p className="text-xs text-muted">
          Tracking only — prices from MarketDataService. Realized P&amp;L is
          unavailable until transaction history exists.
          {portfolio.realizedPnL === null ? " Realized P&L: Unavailable." : null}
        </p>
      </header>

      {feedback ? (
        <div
          role="status"
          className={
            feedback.tone === "ok"
              ? "rounded-md border border-positive/30 bg-positive/10 px-3 py-2 text-sm text-positive"
              : "rounded-md border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative"
          }
        >
          {feedback.message}
        </div>
      ) : null}

      {unavailableHoldings.length > 0 ? (
        <ErrorState
          title="MARKET DATA UNAVAILABLE"
          description={`No valid market price for ${unavailableHoldings
            .map((item) => item.symbol)
            .join(", ")}. Values stay Unavailable — never invented.`}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <section className="space-y-3">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Holdings
          </h3>
          {portfolio.holdings.length === 0 ? (
            <EmptyState
              title="NO HOLDINGS"
              description="Add your first holding to start tracking your portfolio."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Asset</th>
                    <th className="px-3 py-2 font-medium">Quantity</th>
                    <th className="px-3 py-2 font-medium">Avg. Entry</th>
                    <th className="px-3 py-2 font-medium">Current Price</th>
                    <th className="px-3 py-2 font-medium">Market Value</th>
                    <th className="px-3 py-2 font-medium">P&amp;L</th>
                    <th className="px-3 py-2 font-medium">P&amp;L %</th>
                    <th className="px-3 py-2 font-medium">Allocation</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.holdings.map((holding) => (
                    <tr
                      key={holding.id}
                      className="border-b border-border/70 last:border-0"
                    >
                      <td className="px-3 py-2 font-medium">{holding.symbol}</td>
                      <td className="px-3 py-2 font-mono">
                        {editingId === holding.id ? (
                          <Input
                            value={editQuantity}
                            onChange={(event) =>
                              setEditQuantity(event.target.value)
                            }
                            className="h-9 min-w-[5rem]"
                            inputMode="decimal"
                          />
                        ) : (
                          formatPortfolioQuantity(holding.quantity)
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {editingId === holding.id ? (
                          <Input
                            value={editEntry}
                            onChange={(event) =>
                              setEditEntry(event.target.value)
                            }
                            className="h-9 min-w-[5rem]"
                            inputMode="decimal"
                          />
                        ) : (
                          formatPortfolioMoney(
                            holding.averageEntryPrice,
                            currency,
                          )
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {holding.currentPrice === null
                          ? "Unavailable"
                          : formatPortfolioMoney(
                              holding.currentPrice,
                              currency,
                            )}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {formatPortfolioMoney(holding.marketValue, currency)}
                      </td>
                      <td className={pnlClass(holding.unrealizedPnL)}>
                        {formatPortfolioMoney(holding.unrealizedPnL, currency, {
                          signed: true,
                        })}
                      </td>
                      <td className={pnlClass(holding.unrealizedPnLPercent)}>
                        {formatPortfolioPercent(holding.unrealizedPnLPercent, {
                          signed: true,
                        })}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {formatPortfolioPercent(holding.allocationPercent)}
                      </td>
                      <td className="px-3 py-2">
                        <StatusDot status={holding.dataStatus} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {editingId === holding.id ? (
                            <>
                              <Button
                                type="button"
                                className="h-9 px-2 text-xs"
                                disabled={busy}
                                onClick={() => void onSaveEdit(holding.id)}
                              >
                                Save
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-9 px-2 text-xs"
                                disabled={busy}
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-9 px-2 text-xs"
                              disabled={busy}
                              onClick={() => startEdit(holding)}
                            >
                              Edit
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="danger"
                            className="h-9 px-2 text-xs"
                            disabled={busy}
                            onClick={() => void onDelete(holding)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="space-y-3">
          <Card className="space-y-3">
            <CardTitle>Add Holding</CardTitle>
            <form onSubmit={onAddHolding} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="symbol">Asset</Label>
                <Select id="symbol" name="symbol" required defaultValue="NVDA">
                  {MARKET_WATCHLIST.map((asset) => (
                    <option key={asset.symbol} value={asset.symbol}>
                      {asset.symbol} — {asset.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  name="quantity"
                  inputMode="decimal"
                  required
                  placeholder="10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="averageEntryPrice">Average Entry Price</Label>
                <Input
                  id="averageEntryPrice"
                  name="averageEntryPrice"
                  inputMode="decimal"
                  required
                  placeholder="180.00"
                />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                Add Holding
              </Button>
            </form>
          </Card>

          <Card className="space-y-3">
            <CardTitle>Cash</CardTitle>
            <form onSubmit={onSaveCash} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cash">Cash balance</Label>
                <Input
                  id="cash"
                  name="cash"
                  inputMode="decimal"
                  value={cashDraft}
                  onChange={(event) => setCashDraft(event.target.value)}
                />
              </div>
              <Button type="submit" variant="ghost" disabled={busy} className="w-full">
                Update Cash
              </Button>
            </form>
          </Card>

          <Card className="space-y-3">
            <CardTitle>Portfolio Allocation</CardTitle>
            <ul className="space-y-2">
              {portfolio.allocation.map((row) => (
                <li
                  key={row.key}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span>{row.label}</span>
                  <span className="font-mono text-muted">
                    {formatPortfolioPercent(row.allocationPercent)}
                  </span>
                </li>
              ))}
            </ul>
            {portfolio.totalPortfolioValue !== null &&
            portfolio.totalPortfolioValue > 0 ? (
              <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
                {portfolio.allocation.map((row) => {
                  const pct = row.allocationPercent ?? 0;
                  if (pct <= 0) return null;
                  return (
                    <div
                      key={row.key}
                      title={`${row.label} ${formatPortfolioPercent(row.allocationPercent)}`}
                      style={{ width: `${pct}%` }}
                      className={
                        row.key === "CASH"
                          ? "bg-muted/60"
                          : "bg-accent/70"
                      }
                    />
                  );
                })}
              </div>
            ) : null}
          </Card>
        </aside>
      </div>
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
