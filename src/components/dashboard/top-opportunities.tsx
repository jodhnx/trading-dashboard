import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { BriefOpportunityItem } from "@/services/daily-brief/types";

function formatPrice(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(2);
}

function formatQty(value: number | null): string {
  if (value === null) return "—";
  if (Math.abs(value) >= 100) return value.toFixed(2);
  if (Math.abs(value) >= 1) return value.toFixed(4);
  return value.toFixed(6);
}

function formatMoney(value: number | null): string {
  if (value === null) return "—";
  return `€${value.toFixed(2)}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-mono text-sm">{value}</p>
    </div>
  );
}

export function OpportunityCard({ item }: { item: BriefOpportunityItem }) {
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            href={`/market/${encodeURIComponent(item.symbol)}`}
            className="font-mono text-base font-semibold hover:text-accent"
          >
            {item.symbol}
          </Link>
          <Badge tone={item.direction === "LONG" ? "positive" : "negative"}>
            {item.direction}
          </Badge>
          <Badge tone="positive">{item.status}</Badge>
        </div>
        <p className="font-mono text-sm text-muted">
          Score {item.score === null ? "—" : item.score.toFixed(1)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Entry" value={formatPrice(item.entry)} />
        <Metric label="Stop" value={formatPrice(item.stopLoss)} />
        <Metric label="Target" value={formatPrice(item.takeProfit)} />
        <Metric
          label="R:R"
          value={item.riskReward === null ? "—" : item.riskReward.toFixed(2)}
        />
        <Metric label="Risk" value={formatMoney(item.riskAmount)} />
        <Metric label="Position" value={formatQty(item.positionSize)} />
      </div>
      <p className="text-[11px] text-muted">
        Engine values only — not an executed order.
      </p>
    </Card>
  );
}

export function TopOpportunities({
  opportunities,
}: {
  opportunities: BriefOpportunityItem[];
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Top opportunities
        </h3>
        <Link href="/opportunities" className="text-[11px] text-accent hover:underline">
          Full opportunity board →
        </Link>
      </div>
      {opportunities.length === 0 ? (
        <Card>
          <p className="text-sm font-medium">NO HIGH-CONFIDENCE SETUPS</p>
          <p className="mt-1 text-xs text-muted">
            This is a valid result. The Trading Engine found no VALID setups for today.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {opportunities.map((item) => (
            <OpportunityCard key={`${item.symbol}-${item.direction}`} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
