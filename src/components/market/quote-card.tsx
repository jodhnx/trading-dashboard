import Link from "next/link";
import { Card } from "@/components/ui/card";
import { DataStatusBadge } from "@/components/market/data-status-badge";
import type { QuoteResult } from "@/services/market/provider";

function formatPrice(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatChange(value: number | null): string {
  if (value === null) {
    return "—";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatTime(value: Date | null): string {
  if (!value) {
    return "—";
  }
  return value.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function QuoteCard({ result }: { result: QuoteResult }) {
  const changePercent = result.quote?.changePercent ?? null;
  const up = changePercent !== null && changePercent >= 0;

  return (
    <Link href={`/market/${encodeURIComponent(result.symbol)}`} className="block">
      <Card className="h-full transition-colors hover:border-accent/40">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-sm font-semibold">{result.symbol}</p>
            <p className="text-xs text-muted">{result.name}</p>
          </div>
          <DataStatusBadge status={result.status} />
        </div>
        {result.quote ? (
          <>
            <p className="mt-3 text-2xl font-semibold tracking-tight">
              {formatPrice(result.quote.price)}
            </p>
            <p className={up ? "mt-1 text-sm text-positive" : "mt-1 text-sm text-negative"}>
              {result.quote.change !== null
                ? `${result.quote.change > 0 ? "+" : ""}${result.quote.change.toFixed(2)}`
                : "—"}{" "}
              ({formatChange(changePercent)})
            </p>
            <p className="mt-2 text-[11px] text-muted">
              Updated {formatTime(result.quote.dataTimestamp)}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-negative">MARKET DATA UNAVAILABLE</p>
        )}
      </Card>
    </Link>
  );
}
