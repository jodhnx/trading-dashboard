import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { BriefNoTradeItem } from "@/services/daily-brief/types";

export function NoTradeAssets({ items }: { items: BriefNoTradeItem[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
        No trade assets
      </h3>
      <Card>
        {items.length === 0 ? (
          <p className="text-sm text-muted">None listed.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <li
                key={item.symbol}
                className="rounded-md border border-border bg-surface-2/40 px-3 py-2"
              >
                <Link
                  href={`/market/${encodeURIComponent(item.symbol)}`}
                  className="font-mono text-sm font-semibold hover:text-accent"
                >
                  {item.symbol}
                </Link>
                <p className="mt-1 text-xs text-muted">
                  {item.reasons[0] ?? "NO TRADE"}
                  {item.dataStatus === "UNAVAILABLE" ? " · DATA UNAVAILABLE" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
