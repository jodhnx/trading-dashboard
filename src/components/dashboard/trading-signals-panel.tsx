import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export type DashboardTradingSignal = {
  symbol: string;
  direction: string;
  quality: string;
  price: number | null;
  entry: number | null;
  stop: number | null;
  tp1: number | null;
  riskReward: number | null;
  actionLabel: string;
} | null;

function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value >= 1000 ? value.toFixed(0) : value.toFixed(2);
}

function SignalBlock({
  title,
  signal,
}: {
  title: string;
  signal: DashboardTradingSignal;
}) {
  if (!signal) {
    return (
      <Card className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
          {title}
        </p>
        <p className="text-sm font-semibold">NO ACTIONABLE SETUP</p>
        <p className="text-xs text-muted">
          WAIT — no CONFIRMED/STRONG + ELIGIBLE setup with valid levels.
        </p>
        <Link href="/opportunities" className="text-[11px] text-accent hover:underline">
          Open Opportunities →
        </Link>
      </Card>
    );
  }

  return (
    <Card className="space-y-2 border-accent/30">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {title}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/market/${encodeURIComponent(signal.symbol)}`}
          className="font-mono text-lg font-semibold hover:text-accent"
        >
          {signal.symbol}
        </Link>
        <Badge tone={signal.direction === "LONG" ? "positive" : "negative"}>
          {signal.direction}
        </Badge>
        <Badge tone="positive">{signal.quality}</Badge>
        <Badge tone="accent">ELIGIBLE</Badge>
      </div>
      <p className="text-xs font-medium text-accent">{signal.actionLabel}</p>
      <p className="font-mono text-xs text-muted">
        Price {formatPrice(signal.price)} · Entry {formatPrice(signal.entry)} · Stop{" "}
        {formatPrice(signal.stop)} · TP1 {formatPrice(signal.tp1)} · R:R{" "}
        {signal.riskReward?.toFixed(2) ?? "—"}
      </p>
      <Link href="/opportunities" className="text-[11px] text-accent hover:underline">
        Full trading signal board →
      </Link>
    </Card>
  );
}

export function TradingSignalsPanel({
  bestStock,
  bestCrypto,
}: {
  bestStock: DashboardTradingSignal;
  bestCrypto: DashboardTradingSignal;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
        Today&apos;s trading signal
      </h3>
      <div className="grid gap-3 lg:grid-cols-2">
        <SignalBlock title="Best stock" signal={bestStock} />
        <SignalBlock title="Best crypto" signal={bestCrypto} />
      </div>
    </section>
  );
}
