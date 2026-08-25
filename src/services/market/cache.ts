export class MemoryCache<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) {
      return undefined;
    }
    if (hit.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  peek(key: string): T | undefined {
    return this.store.get(key)?.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: this.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export const quoteCache = new MemoryCache<unknown>();
export const candleCache = new MemoryCache<unknown>();
export const technicalCache = new MemoryCache<unknown>();
