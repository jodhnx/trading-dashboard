import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { DashboardWatchRow } from "@/services/dashboard/view-model";

export function Watchlist({ items }: { items: DashboardWatchRow[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
        Watchlist
      </h3>
      <Card className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted">No assets currently on the watchlist.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.symbol} className="py-2 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={`/market/${encodeURIComponent(item.symbol)}`}
                    className="font-mono text-sm font-semibold hover:text-accent"
                  >
                    {item.symbol}
                  </Link>
                  <span className="text-[11px] uppercase tracking-wide text-muted">
                    {item.technicalCondition}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{item.reason}</p>
                {item.newsHeadline ? (
                  <p className="mt-1 text-xs text-muted">News: {item.newsHeadline}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
