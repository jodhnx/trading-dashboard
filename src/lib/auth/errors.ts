import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";

export function publicAuthError(error: AuthError): string {
  if (isAuthRetryableFetchError(error) || error.status === 0) {
    return "Cannot reach Supabase Auth. Check SUPABASE_URL and your network, then restart the dev server.";
  }

  if (error.code === "email_not_confirmed") {
    return "This email is not confirmed yet.";
  }

  return "Invalid email or password.";
}
