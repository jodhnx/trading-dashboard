import { cn } from "@/lib/cn";

export function MarketCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4" role="status">
      <div className="h-3 w-16 rounded bg-surface-2" />
      <div className="mt-3 h-6 w-28 rounded bg-surface-2" />
      <div className="mt-2 h-3 w-20 rounded bg-surface-2" />
    </div>
  );
}

export function MarketOverviewSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <MarketCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("h-64 rounded-lg border border-border bg-surface", className)}
      role="status"
    >
      <div className="h-full w-full rounded-lg bg-surface-2/60" />
    </div>
  );
}
