import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { DashboardHistoryItem } from "@/services/dashboard/view-model";

export function BriefHistory({ items }: { items: DashboardHistoryItem[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
        Daily Brief history
      </h3>
      <Card>
        {items.length === 0 ? (
          <p className="text-sm text-muted">No stored briefs yet.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {items.map((item) => (
              <Link
                key={item.briefDate}
                href={item.href}
                className={`shrink-0 rounded-md border px-3 py-2 text-xs transition-colors ${
                  item.isToday
                    ? "border-accent/50 bg-accent/10 text-foreground"
                    : "border-border bg-surface-2/40 text-muted hover:border-accent/40 hover:text-foreground"
                }`}
              >
                <span className="block font-medium">{item.label}</span>
                <span className="mt-0.5 block font-mono text-[10px]">
                  {item.briefDate} · {item.finalStatus}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
