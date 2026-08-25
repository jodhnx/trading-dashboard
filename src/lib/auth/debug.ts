import { createClient } from "@supabase/supabase-js";
import { loginSchema } from "@/lib/auth/schema";
import { resolvePublicEnv, resolveSecretEnv } from "@/lib/env/resolve";

export type AuthDebugReport = {
  SUPABASE_URL: "MATCH" | "MISMATCH";
  PUBLISHABLE_KEY: "FOUND" | "MISSING";
  AUTH_EMAIL_PASSWORD: "ENABLED" | "DISABLED" | "UNKNOWN";
  USER_LOOKUP: "FOUND" | "NOT_FOUND" | "ERROR";
  SIGN_IN: "SUCCESS" | "AUTH_ERROR";
  SESSION: "PRESENT" | "MISSING";
};

type DiagnoseInput = {
  email?: string;
  password?: string;
  env?: Record<string, string | undefined>;
  fetchFn?: typeof fetch;
};

function parseJwtRef(key: string): string | null {
  if (!key.startsWith("eyJ")) {
    return null;
  }
  const parts = key.split(".");
  if (parts.length < 2) {
    return null;
  }
  try {
    const padded = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(json) as { ref?: unknown };
    return typeof payload.ref === "string" ? payload.ref : null;
  } catch {
    return null;
  }
}

function projectRefFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.split(".")[0] ?? null;
  } catch {
    return null;
  }
}

export function compareSupabaseUrl(
  env: Record<string, string | undefined>,
): "MATCH" | "MISMATCH" {
  const publicEnv = resolvePublicEnv(env);
  const resolved = publicEnv.supabaseUrl;
  if (!resolved) {
    return "MISMATCH";
  }

  const primary = env.SUPABASE_URL?.trim();
  const alias = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (primary && alias && primary !== alias) {
    return "MISMATCH";
  }

  const key =
    env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";
  const jwtRef = parseJwtRef(key);
  const urlRef = projectRefFromUrl(resolved);
  if (jwtRef && urlRef && jwtRef !== urlRef) {
    return "MISMATCH";
  }

  return "MATCH";
}

export async function diagnoseAuth(
  input: DiagnoseInput = {},
): Promise<AuthDebugReport> {
  const env = input.env ?? process.env;
  const fetchFn = input.fetchFn ?? fetch;
  const publicEnv = resolvePublicEnv(env);
  const secretEnv = resolveSecretEnv(env);

  const report: AuthDebugReport = {
    SUPABASE_URL: compareSupabaseUrl(env),
    PUBLISHABLE_KEY: publicEnv.supabasePublishableKey ? "FOUND" : "MISSING",
    AUTH_EMAIL_PASSWORD: "UNKNOWN",
    USER_LOOKUP: "ERROR",
    SIGN_IN: "AUTH_ERROR",
    SESSION: "MISSING",
  };

  if (!publicEnv.supabaseUrl || !publicEnv.supabasePublishableKey) {
    return report;
  }

  try {
    const settingsResponse = await fetchFn(
      `${publicEnv.supabaseUrl.replace(/\/$/, "")}/auth/v1/settings`,
      {
        headers: {
          apikey: publicEnv.supabasePublishableKey,
          Authorization: `Bearer ${publicEnv.supabasePublishableKey}`,
        },
        cache: "no-store",
      },
    );
    if (settingsResponse.ok) {
      const settings = (await settingsResponse.json()) as {
        external?: { email?: boolean };
      };
      report.AUTH_EMAIL_PASSWORD =
        settings.external?.email === false ? "DISABLED" : "ENABLED";
    }
  } catch {
    report.AUTH_EMAIL_PASSWORD = "UNKNOWN";
  }

  const email = input.email?.trim() ?? "";
  const password = input.password ?? "";

  if (secretEnv.supabaseSecretKey && email) {
    try {
      const admin = createClient(publicEnv.supabaseUrl, secretEnv.supabaseSecretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
      if (error) {
        report.USER_LOOKUP = "ERROR";
      } else {
        const needle = email.toLowerCase();
        const found = (data.users ?? []).some(
          (user) => (user.email ?? "").toLowerCase() === needle,
        );
        report.USER_LOOKUP = found ? "FOUND" : "NOT_FOUND";
      }
    } catch {
      report.USER_LOOKUP = "ERROR";
    }
  }

  const parsed = loginSchema.safeParse({ email, password });
  if (parsed.success) {
    const authClient = createClient(
      publicEnv.supabaseUrl,
      publicEnv.supabasePublishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    const { data, error } = await authClient.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (!error && data.session && data.user) {
      report.SIGN_IN = "SUCCESS";
      report.SESSION = "PRESENT";
    } else {
      report.SIGN_IN = "AUTH_ERROR";
      report.SESSION = data.session ? "PRESENT" : "MISSING";
    }
  }

  return report;
}
