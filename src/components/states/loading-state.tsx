export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4" role="status">
      <p className="mb-3 text-xs uppercase tracking-wide text-muted">{label}</p>
      <div className="space-y-2">
        <div className="h-4 w-1/3 rounded bg-surface-2" />
        <div className="h-4 w-2/3 rounded bg-surface-2" />
        <div className="h-4 w-1/2 rounded bg-surface-2" />
      </div>
    </div>
  );
}
