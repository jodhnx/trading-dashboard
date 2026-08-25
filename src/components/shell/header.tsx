import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/auth/logout-button";

export function Header({
  title,
  marketProvider,
  supabaseConfigured,
}: {
  title: string;
  marketProvider: "twelve-data" | "mock" | "unavailable";
  supabaseConfigured: boolean;
}) {
  const marketBadge =
    marketProvider === "mock"
      ? { tone: "warning" as const, label: "MOCK DATA" }
      : marketProvider === "unavailable"
        ? { tone: "negative" as const, label: "MARKET DATA UNAVAILABLE" }
        : { tone: "accent" as const, label: "TWELVE DATA" };

  return (
    <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border bg-surface px-4 md:px-6">
      <div>
        <h1 className="text-sm font-semibold tracking-tight">{title}</h1>
        <p className="text-[11px] text-muted">Private workspace</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Badge tone={marketBadge.tone}>{marketBadge.label}</Badge>
        <Badge tone={supabaseConfigured ? "positive" : "warning"}>
          {supabaseConfigured ? "SUPABASE READY" : "SUPABASE UNCONFIGURED"}
        </Badge>
        <LogoutButton />
      </div>
    </header>
  );
}
