export interface QueryInfo {
  name: string;
  type: string;
  client: string;
  blocked: boolean;
  cached: boolean;
  forwarded: boolean;
  timestamp?: string;
}

export class QueryLogger {
  private queries: QueryInfo[];
  private maxEntries: number;
  private stats: {
    total: number;
    blocked: number;
    cached: number;
    forwarded: number;
  };

  constructor(maxEntries = 1000) {
    this.queries = [];
    this.maxEntries = maxEntries;
    this.stats = {
      total: 0,
      blocked: 0,
      cached: 0,
      forwarded: 0
    };
  }

  log(query: QueryInfo): void {
    this.queries.unshift({
      ...query,
      timestamp: new Date().toISOString()
    });
    if (this.queries.length > this.maxEntries) {
      this.queries.pop();
    }
    this.stats.total++;
    if (query.blocked) this.stats.blocked++;
    if (query.cached) this.stats.cached++;
    if (query.forwarded) this.stats.forwarded++;
  }

  getQueries(limit = 100): QueryInfo[] {
    return this.queries.slice(0, limit);
  }

  getStats() {
    return this.stats;
  }

  clear(): void {
    this.queries = [];
    this.stats = {
      total: 0,
      blocked: 0,
      cached: 0,
      forwarded: 0
    };
  }
}
