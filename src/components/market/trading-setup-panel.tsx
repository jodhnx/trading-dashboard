import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataStatusBadge } from "@/components/market/data-status-badge";
import { OpenPaperTradeButton } from "@/components/paper/open-paper-trade-button";
import type { SerializedTradingSetup } from "@/services/market/serialize";
import type { DataStatus } from "@/services/market/provider";

function formatPrice(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return value.toFixed(2);
}

function formatQty(value: number | null): string {
  if (value === null) {
    return "—";
  }
  if (Math.abs(value) >= 100) {
    return value.toFixed(2);
  }
  if (Math.abs(value) >= 1) {
    return value.toFixed(4);
  }
  return value.toFixed(6);
}

function formatRr(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return `${value.toFixed(2)} : 1`;
}

function formatMoney(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return value.toFixed(2);
}

function formatPercentFraction(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function directionTone(
  direction: SerializedTradingSetup["direction"],
): "positive" | "negative" | "warning" | "neutral" {
  if (direction === "LONG") return "positive";
  if (direction === "SHORT") return "negative";
  return "warning";
}

function statusTone(
  status: SerializedTradingSetup["status"],
): "positive" | "negative" | "warning" {
  if (status === "VALID") return "positive";
  if (status === "INVALID") return "negative";
  return "warning";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-2/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono text-sm font-medium">{value}</p>
    </div>
  );
}

export function TradingSetupPanel({
  setup,
  symbol,
  timeframe,
}: {
  setup: SerializedTradingSetup;
  symbol?: string;
  timeframe?: string;
}) {
  const dataStatus = setup.dataStatus as DataStatus;
  const noTrade = setup.direction === "NO_TRADE";

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Trading Setup
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <DataStatusBadge status={dataStatus} />
          <Badge tone={statusTone(setup.status)}>{setup.status}</Badge>
          <Badge tone={directionTone(setup.direction)}>
            {noTrade ? "NO TRADE" : setup.direction}
          </Badge>
        </div>
      </div>

      <p className="text-xs text-muted">
        Theoretical calculation only. Not an order. Score is not a probability
        and not expected return.
      </p>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Score"
          value={setup.score === null ? "—" : setup.score.toFixed(1)}
        />
        <Metric label="Entry" value={formatPrice(setup.entry)} />
        <Metric label="Stop loss" value={formatPrice(setup.stopLoss)} />
        <Metric label="Take profit" value={formatPrice(setup.takeProfit)} />
        <Metric label="Risk / Reward" value={formatRr(setup.riskReward)} />
        <Metric
          label="Risk amount"
          value={`${formatMoney(setup.riskAmount)} (${formatPercentFraction(setup.riskPercent)})`}
        />
        <Metric label="Position size" value={formatQty(setup.positionSize)} />
        <Metric label="Position value" value={formatMoney(setup.positionValue)} />
      </div>

      {noTrade ? (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
          <p className="text-sm font-medium">NO TRADE</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-muted">
            {(setup.rejectReasons.length > 0
              ? setup.reasons
              : ["No trade"]
            ).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {setup.status === "REJECTED" && !noTrade ? (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
          <p className="text-sm font-medium">REJECTED</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-muted">
            {setup.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {setup.status === "INVALID" ? (
        <div className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2">
          <p className="text-sm font-medium">INVALID</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-muted">
            {setup.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {setup.status === "VALID" && setup.reasons.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-4 text-sm text-muted">
          {setup.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      {symbol && timeframe ? (
        <OpenPaperTradeButton
          symbol={symbol}
          timeframe={timeframe}
          setup={setup}
        />
      ) : null}
    </Card>
  );
}
