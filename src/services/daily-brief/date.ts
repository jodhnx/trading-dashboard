const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidBriefDate(value: string): boolean {
  if (!DATE_RE.test(value)) {
    return false;
  }
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m! - 1 &&
    dt.getUTCDate() === d
  );
}

/** Trading date in UTC (YYYY-MM-DD). */
export function utcBriefDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function parseBriefDateParam(
  raw: string | null | undefined,
  now: Date = new Date(),
): { ok: true; date: string } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return { ok: true, date: utcBriefDate(now) };
  }
  const trimmed = raw.trim();
  if (!isValidBriefDate(trimmed)) {
    return { ok: false, error: "Invalid date. Use YYYY-MM-DD." };
  }
  return { ok: true, date: trimmed };
}

export function briefDayBoundsUtc(briefDate: string): {
  start: Date;
  end: Date;
} {
  const start = new Date(`${briefDate}T00:00:00.000Z`);
  const end = new Date(`${briefDate}T23:59:59.999Z`);
  return { start, end };
}

export function isBriefStale(input: {
  briefDate: string;
  generatedAt: string;
  now?: Date;
  staleAfterHours?: number;
}): boolean {
  const now = input.now ?? new Date();
  const today = utcBriefDate(now);
  if (input.briefDate < today) {
    return true;
  }
  const generated = Date.parse(input.generatedAt);
  if (!Number.isFinite(generated)) {
    return true;
  }
  const hours = input.staleAfterHours ?? 36;
  return now.getTime() - generated > hours * 60 * 60 * 1000;
}
