import { AppShell } from "@/components/shell/app-shell";
import { ErrorState } from "@/components/states/error-state";
import { EnvValidationError } from "@/lib/env/errors";
import { getMarketProviderInfo, getPublicEnv } from "@/lib/env/public";
import type { MarketProviderResolution } from "@/lib/env/resolve";
import type { ReactNode } from "react";

function resolveMarket():
  | { ok: true; market: MarketProviderResolution }
  | { ok: false; message: string } {
  try {
    return { ok: true, market: getMarketProviderInfo() };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof EnvValidationError
          ? error.message
          : "Environment validation failed.",
    };
  }
}

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  const { supabaseConfigured } = getPublicEnv();
  const resolved = resolveMarket();

  if (!resolved.ok) {
    return (
      <div className="p-6">
        <ErrorState title="DATA UNAVAILABLE" description={resolved.message} />
      </div>
    );
  }

  return (
    <AppShell
      title="Trading Dashboard"
      marketProvider={resolved.market.providerId}
      supabaseConfigured={supabaseConfigured}
    >
      {children}
    </AppShell>
  );
}
