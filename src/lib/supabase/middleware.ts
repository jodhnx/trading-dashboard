import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env/public";
import { requirePublicSupabase } from "@/lib/env/resolve";
import { EnvValidationError } from "@/lib/env/errors";
import { isAuthEntryPath, isPublicPath } from "@/lib/auth/routes";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  let url: string;
  let publishableKey: string;
  try {
    const resolved = requirePublicSupabase(getPublicEnv());
    url = resolved.url;
    publishableKey = resolved.publishableKey;
  } catch (error) {
    if (error instanceof EnvValidationError) {
      if (isPublicPath(pathname)) {
        return response;
      }
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Unauthorized", code: "UNAUTHORIZED" },
          { status: 401 },
        );
      }
      return redirectToLogin(request);
    }
    throw error;
  }

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      const unauthorized = NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
      response.cookies.getAll().forEach((cookie) => {
        unauthorized.cookies.set(cookie.name, cookie.value);
      });
      return unauthorized;
    }
    return redirectToLogin(request);
  }

  if (user && isAuthEntryPath(pathname)) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/";
    destination.search = "";
    return NextResponse.redirect(destination);
  }

  return response;
}

function redirectToLogin(request: NextRequest) {
  const destination = request.nextUrl.clone();
  destination.pathname = "/login";
  destination.search = "";
  return NextResponse.redirect(destination);
}
