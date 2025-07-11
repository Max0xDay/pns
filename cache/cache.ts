export interface CacheEntry {
  value: Uint8Array;
  expires: number;
}

export class DNSCache {
  private cache: Map<string, CacheEntry>;
  private maxEntries: number;
  private defaultTTL: number;
  private hits: number;
  private misses: number;

  constructor(maxEntries = 10000, defaultTTL = 300) {
    this.cache = new Map();
    this.maxEntries = maxEntries;
    this.defaultTTL = defaultTTL;
    this.hits = 0;
    this.misses = 0;
  }

  set(key: string, value: Uint8Array, ttl = this.defaultTTL): void {
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    const expires = Date.now() + (ttl * 1000);
    this.cache.set(key, {
      value,
      expires
    });
  }

  get(key: string): Uint8Array | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    const now = Date.now();
    if (now > entry.expires) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.value;
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats() {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? Math.round((this.hits / totalRequests) * 100) : 0;
    
    return {
      entries: this.cache.size,
      size: this.cache.size,
      maxSize: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate: hitRate
    };
  }
}
