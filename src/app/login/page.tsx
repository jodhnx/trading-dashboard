import { LoginForm } from "@/components/auth/login-form";
import { getPublicEnv } from "@/lib/env/public";
import { ErrorState } from "@/components/states/error-state";

export default function LoginPage() {
  const { supabaseConfigured } = getPublicEnv();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            Private
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">Trading Desk</h1>
          <p className="mt-1 text-sm text-muted">
            Sign in to open your research workspace.
          </p>
        </div>
        {!supabaseConfigured ? (
          <ErrorState
            title="DATA UNAVAILABLE"
            description="Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.local."
          />
        ) : (
          <LoginForm />
        )}
      </div>
    </div>
  );
}
