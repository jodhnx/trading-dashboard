export const PUBLIC_PATHS = ["/login", "/api/health"] as const;

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return true;
  }
  if (pathname === "/api/health") {
    return true;
  }
  if (process.env.NODE_ENV !== "production" && pathname === "/api/auth/debug") {
    return true;
  }
  return false;
}

export function isAuthEntryPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/login/");
}

export function unauthorizedPayload() {
  return {
    error: "Unauthorized",
    code: "UNAUTHORIZED",
  } as const;
}
