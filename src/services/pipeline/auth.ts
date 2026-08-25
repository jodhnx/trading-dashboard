import "server-only";

/**
 * Verify cron authorization.
 * Vercel Cron sends Authorization: Bearer <CRON_SECRET>.
 * Local testing uses the same header — never expose CRON_SECRET to the client.
 */
export function verifyCronAuthorization(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const header = request.headers.get("authorization")?.trim();
  if (!header) {
    return false;
  }

  const [scheme, token] = header.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return false;
  }

  return timingSafeEqual(token, secret);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function isCronConfigured(): boolean {
  return Boolean(process.env.CRON_SECRET?.trim());
}
