import { Card } from "@/components/ui/card";

export function RiskPanel({ risks }: { risks: string[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
        Risks
      </h3>
      <Card>
        {risks.length === 0 ? (
          <p className="text-sm text-muted">No stored risks listed. UNKNOWN.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-4 text-sm text-muted">
            {risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
