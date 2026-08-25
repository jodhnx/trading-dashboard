import { EmptyState } from "@/components/states/empty-state";

export function PagePlaceholder({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <EmptyState
        title={`${title} is not built yet`}
        description={`This screen lands in ${phase}. Phase 2 only ships the shell, schema, and market-data provider.`}
      />
    </div>
  );
}
