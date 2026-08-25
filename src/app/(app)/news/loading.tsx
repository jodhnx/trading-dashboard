import { Card } from "@/components/ui/card";

export default function NewsLoading() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">News</h2>
        <p className="text-sm text-muted">Loading stored headlines…</p>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="h-36 animate-pulse bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
