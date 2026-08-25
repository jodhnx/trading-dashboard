import { MarketOverviewSkeleton } from "@/components/market/skeletons";

export default function MarketLoading() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Market</h2>
        <p className="text-sm text-muted">Loading quotes…</p>
      </div>
      <MarketOverviewSkeleton />
    </div>
  );
}
