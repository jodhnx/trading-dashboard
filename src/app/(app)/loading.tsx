import { MarketCardSkeleton } from "@/components/market/skeletons";

export default function DashboardLoading() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading dashboard">
      <div className="h-4 w-20 rounded bg-surface-2" />
      <div className="h-8 w-48 rounded bg-surface-2" />
      <div className="h-28 rounded-lg border border-border bg-surface" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <MarketCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
