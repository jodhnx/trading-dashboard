const inflight = new Set<string>();

export function beginAnalysisRequest(key: string): boolean {
  if (inflight.has(key)) {
    return false;
  }
  inflight.add(key);
  return true;
}

export function endAnalysisRequest(key: string): void {
  inflight.delete(key);
}

export function resetAnalysisRequests(): void {
  inflight.clear();
}

export function analysisRequestKey(
  userId: string,
  symbol: string,
  timeframe: string,
): string {
  return `${userId}:${symbol}:${timeframe}`;
}
