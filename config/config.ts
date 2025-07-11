export interface CustomRecord {
  name: string;
  type: string;
  ttl: number;
  address?: string;
  data?: string;
}

export interface PNSConfigData {
  dnsPort: number;
  webPort: number;
  forwarders: string[];
  cache: {
    enabled: boolean;
    ttl: number;
    maxEntries: number;
  };
  blocklist: {
    enabled: boolean;
    domains: string[];
  };
  customRecords: CustomRecord[];
  logging: {
    enabled: boolean;
    maxEntries: number;
  };
}

export class PNSConfig {
  private configFile: string;
  private defaultConfig: PNSConfigData;
  public config: PNSConfigData | null = null;

  constructor(configFile = './pns-config.json') {
    this.configFile = configFile;
    this.defaultConfig = {
      dnsPort: 53,
      webPort: 8080,
      forwarders: ['8.8.8.8', '8.8.4.4', '1.1.1.1'],
      cache: {
        enabled: true,
        ttl: 300,
        maxEntries: 10000
      },
      blocklist: {
        enabled: true,
        domains: ['example-blocked-domain.com']
      },
      customRecords: [
        { name: 'local.pns', type: 'A', ttl: 300, address: '192.168.1.100' }
      ],
      logging: {
        enabled: true,
        maxEntries: 1000
      }
    };
  }

  async load(): Promise<PNSConfigData> {
    try {
      const data = await Deno.readTextFile(this.configFile);
      const parsed = JSON.parse(data);
      this.config = this.validateAndMergeConfig(parsed);
    } catch (_err) {
      this.config = this.defaultConfig;
      await this.save();
    }
    return this.config!;
  }

  private validateAndMergeConfig(config: Record<string, unknown>): PNSConfigData {
    return {
      dnsPort: Number(config.dnsPort) || this.defaultConfig.dnsPort,
      webPort: Number(config.webPort) || this.defaultConfig.webPort,
      forwarders: Array.isArray(config.forwarders) ? config.forwarders : this.defaultConfig.forwarders,
      cache: {
        enabled: Boolean((config.cache as Record<string, unknown>)?.enabled ?? this.defaultConfig.cache.enabled),
        ttl: Number((config.cache as Record<string, unknown>)?.ttl) || this.defaultConfig.cache.ttl,
        maxEntries: Number((config.cache as Record<string, unknown>)?.maxEntries) || this.defaultConfig.cache.maxEntries
      },
      blocklist: {
        enabled: Boolean((config.blocklist as Record<string, unknown>)?.enabled ?? this.defaultConfig.blocklist.enabled),
        domains: Array.isArray((config.blocklist as Record<string, unknown>)?.domains) ? 
          (config.blocklist as Record<string, unknown>).domains as string[] : this.defaultConfig.blocklist.domains
      },
      customRecords: Array.isArray(config.customRecords) ? 
        (config.customRecords as Record<string, unknown>[]).map(record => ({
          name: String(record.name || ''),
          type: String(record.type || 'A'),
          ttl: Number(record.ttl) || 300,
          address: record.address ? String(record.address) : undefined,
          data: record.data ? String(record.data) : undefined
        })) : this.defaultConfig.customRecords,
      logging: {
        enabled: Boolean((config.logging as Record<string, unknown>)?.enabled ?? this.defaultConfig.logging.enabled),
        maxEntries: Number((config.logging as Record<string, unknown>)?.maxEntries) || this.defaultConfig.logging.maxEntries
      }
    };
  }

  async save(): Promise<void> {
    await Deno.writeTextFile(this.configFile, JSON.stringify(this.config, null, 2));
  }

  update(newConfig: Partial<PNSConfigData>): void {
    this.config = { ...this.config!, ...newConfig };
    this.save();
  }
}
