export interface CacheEntry {
  value: Uint8Array;
  expires: number;
}

export class DNSCache {
  private cache: Map<string, CacheEntry>;
  private maxEntries: number;
  private defaultTTL: number;

  constructor(maxEntries = 10000, defaultTTL = 300) {
    this.cache = new Map();
    this.maxEntries = maxEntries;
    this.defaultTTL = defaultTTL;
  }

  set(key: string, value: Uint8Array, ttl = this.defaultTTL): void {
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, {
      value,
      expires: Date.now() + (ttl * 1000)
    });
  }

  get(key: string): Uint8Array | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  clear(): void {
    this.cache.clear();
  }

  stats() {
    return {
      size: this.cache.size,
      maxSize: this.maxEntries
    };
  }
}
