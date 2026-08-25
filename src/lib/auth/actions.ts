"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EnvValidationError } from "@/lib/env/errors";
import { loginSchema } from "@/lib/auth/schema";
import { publicAuthError } from "@/lib/auth/errors";

export type AuthActionState = {
  error: string | null;
};

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid login details." };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      return { error: publicAuthError(error) };
    }
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return {
        error:
          "Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.local.",
      };
    }
    return { error: "Login failed. Try again." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logoutAction() {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    // Still send the user to login if the session is already gone.
  }

  revalidatePath("/", "layout");
  redirect("/login");
}
