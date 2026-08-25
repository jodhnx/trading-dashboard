import Link from "next/link";
import { Card } from "@/components/ui/card";
import { DataStatusBadge } from "@/components/market/data-status-badge";
import type { BriefMarketItem } from "@/services/daily-brief/types";
import { DATA_STATUSES, type DataStatus } from "@/services/market/provider";

function asDataStatus(value: string): DataStatus {
  return (DATA_STATUSES as readonly string[]).includes(value)
    ? (value as DataStatus)
    : "UNAVAILABLE";
}

function formatPrice(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatChange(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function MarketAssetCard({ item }: { item: BriefMarketItem }) {
  const change = item.changePercent;
  const up = change !== null && change >= 0;
  const unavailable = item.price === null || item.dataStatus === "UNAVAILABLE";

  return (
    <Link
      href={`/market/${encodeURIComponent(item.symbol)}`}
      className="min-w-[9.5rem] shrink-0 snap-start sm:min-w-0"
    >
      <Card className="h-full transition-colors hover:border-accent/40">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-sm font-semibold">{item.symbol}</p>
            <p className="truncate text-[11px] text-muted">{item.name}</p>
          </div>
          <DataStatusBadge status={asDataStatus(item.dataStatus)} />
        </div>
        {unavailable ? (
          <p className="mt-3 text-sm text-negative">DATA UNAVAILABLE</p>
        ) : (
          <>
            <p className="mt-3 font-mono text-xl font-semibold tracking-tight">
              {formatPrice(item.price)}
            </p>
            <p
              className={
                up ? "mt-1 text-sm text-positive" : "mt-1 text-sm text-negative"
              }
            >
              {formatChange(change)}
            </p>
          </>
        )}
      </Card>
    </Link>
  );
}

export function MarketOverview({ items }: { items: BriefMarketItem[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
        Market overview
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-1 snap-x md:grid md:grid-cols-3 md:overflow-visible xl:grid-cols-6">
        {items.map((item) => (
          <MarketAssetCard key={item.symbol} item={item} />
        ))}
      </div>
    </section>
  );
}
