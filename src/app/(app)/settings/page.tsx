import { SettingsForm } from "@/components/settings/settings-form";
import { ErrorState } from "@/components/states/error-state";
import { EmptyState } from "@/components/states/empty-state";
import { getAuthUser } from "@/lib/auth/session";
import { getOrCreateAccountSettings } from "@/lib/settings/service";
import type { AccountSettings } from "@/lib/settings/schema";
import { redirect } from "next/navigation";

async function loadSettings(): Promise<
  { ok: true; settings: AccountSettings } | { ok: false }
> {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }

  try {
    const settings = await getOrCreateAccountSettings(user.id, user.email ?? null);
    return { ok: true, settings };
  } catch {
    return { ok: false };
  }
}

export default async function SettingsPage() {
  const loaded = await loadSettings();

  if (!loaded.ok) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
        <ErrorState
          title="DATA UNAVAILABLE"
          description="Could not load your profile or settings. Confirm the database migration has been applied."
        />
        <EmptyState
          title="NO SETTINGS LOADED"
          description="Your user_settings row is created automatically on first login when the auth trigger is active."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted">
          Risk per trade, max position size, and minimum R:R are stored in Supabase
          and used by the deterministic trading engine. Percent values in this form
          (1%) are stored as fractions (0.01).
        </p>
      </div>
      <SettingsForm initial={loaded.settings} />
    </div>
  );
}
