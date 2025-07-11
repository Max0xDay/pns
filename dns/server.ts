import { DNSPacket } from "./packet.ts";
import { DNSResolver } from "./resolver.ts";
import { DNS_TYPES, DNS_RCODES } from "./constants.ts";
import { DNSCache } from "../cache/cache.ts";
import { QueryLogger, QueryInfo } from "../logger/logger.ts";
import { PNSConfig } from "../config/config.ts";

export class DNSServer {
  private config: PNSConfig;
  private cache: DNSCache;
  private logger: QueryLogger;
  private resolver: DNSResolver;
  private tcpListener?: Deno.Listener;
  private wsConnections: Set<WebSocket> = new Set();

  constructor(config: PNSConfig, cache: DNSCache, logger: QueryLogger) {
    this.config = config;
    this.cache = cache;
    this.logger = logger;
    this.resolver = new DNSResolver(config.config!.forwarders);
  }

  start(port: number) {
    this.startTCP(port);
  }

  private startTCP(port: number) {
    this.tcpListener = Deno.listen({
      port,
      hostname: "0.0.0.0"
    });
    this.handleTCP();
  }

  private async handleTCP() {
    for await (const conn of this.tcpListener!) {
      this.handleTCPConnection(conn);
    }
  }

  private async handleTCPConnection(conn: Deno.Conn) {
    try {
      const buffer = new Uint8Array(514);
      const n = await conn.read(buffer);
      
      if (n && n > 2) {
        const len = (buffer[0] << 8) | buffer[1];
        const query = buffer.slice(2, 2 + len);
        
        const addr = (conn.remoteAddr as Deno.NetAddr);
        await this.handleDNSQuery(query, addr, async (response) => {
          const tcpResponse = new Uint8Array(response.length + 2);
          tcpResponse[0] = (response.length >> 8) & 0xff;
          tcpResponse[1] = response.length & 0xff;
          tcpResponse.set(response, 2);
          await conn.write(tcpResponse);
        });
      }
    } catch (_err) {
    } finally {
      conn.close();
    }
  }

  private async handleDNSQuery(
    buffer: Uint8Array, 
    rinfo: Deno.Addr, 
    callback: (response: Uint8Array) => Promise<void>
  ) {
    try {
      const request = new DNSPacket(buffer).parse();
      const question = request.questions[0];
      
      if (!question) {
        const response = DNSPacket.createResponse(request);
        response.header.rcode = DNS_RCODES.FORMERR;
        await callback(response.toBuffer());
        return;
      }

      const queryInfo: QueryInfo = {
        name: question.name,
        type: Object.keys(DNS_TYPES).find(k => DNS_TYPES[k as keyof typeof DNS_TYPES] === question.type) || question.type.toString(),
        client: (rinfo as Deno.NetAddr).hostname,
        blocked: false,
        cached: false,
        forwarded: false
      };

      if (this.config.config!.blocklist.enabled && 
          this.config.config!.blocklist.domains.some(domain => 
            question.name.toLowerCase().includes(domain.toLowerCase()))) {
        queryInfo.blocked = true;
        const response = DNSPacket.createResponse(request);
        response.header.rcode = DNS_RCODES.NXDOMAIN;
        await callback(response.toBuffer());
        this.logQuery(queryInfo);
        return;
      }

      const customRecord = this.config.config!.customRecords.find(record => 
        record.name.toLowerCase() === question.name.toLowerCase() && 
        record.type === queryInfo.type
      );

      if (customRecord) {
        const response = DNSPacket.createResponse(request);
        response.answers.push({
          name: question.name,
          type: question.type,
          class: question.class,
          ttl: customRecord.ttl,
          address: customRecord.address
        });
        response.header.ancount = 1;
        await callback(response.toBuffer());
        this.logQuery(queryInfo);
        return;
      }

      const cacheKey = `${question.name}:${question.type}`;
      if (this.config.config!.cache.enabled) {
        const cached = this.cache.get(cacheKey);
        if (cached) {
          queryInfo.cached = true;
          const response = new DNSPacket(cached).parse();
          response.header.id = request.header.id;
          await callback(response.toBuffer());
          this.logQuery(queryInfo);
          return;
        }
      }

      queryInfo.forwarded = true;
      const response = await this.resolver.resolve(request);
      const responseBuffer = response.toBuffer();
      
      if (this.config.config!.cache.enabled && response.answers.length > 0) {
        const ttl = Math.min(...response.answers.map(a => a.ttl || 300));
        this.cache.set(cacheKey, responseBuffer, ttl);
      }

      await callback(responseBuffer);
      this.logQuery(queryInfo);

    } catch (_err) {
      try {
        const request = new DNSPacket(buffer).parse();
        const response = DNSPacket.createResponse(request);
        response.header.rcode = DNS_RCODES.SERVFAIL;
        await callback(response.toBuffer());
      } catch {
        // Drop if we can't parse the request
      }
    }
  }

  private logQuery(queryInfo: QueryInfo) {
    this.logger.log(queryInfo);
    
    const message = JSON.stringify({
      type: 'query',
      query: queryInfo
    });
    
    for (const ws of this.wsConnections) {
      try {
        ws.send(message);
      } catch {
        this.wsConnections.delete(ws);
      }
    }
  }

  addWebSocketConnection(ws: WebSocket) {
    this.wsConnections.add(ws);
  }

  removeWebSocketConnection(ws: WebSocket) {
    this.wsConnections.delete(ws);
  }

  stop() {
    this.tcpListener?.close();
  }
}
