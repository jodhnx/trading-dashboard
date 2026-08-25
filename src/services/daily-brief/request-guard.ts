const inflight = new Set<string>();

export function briefRequestKey(userId: string, briefDate: string): string {
  return `${userId}:${briefDate}`;
}

export function beginBriefRequest(key: string): boolean {
  if (inflight.has(key)) {
    return false;
  }
  inflight.add(key);
  return true;
}

export function endBriefRequest(key: string): void {
  inflight.delete(key);
}

export function resetBriefRequests(): void {
  inflight.clear();
}
