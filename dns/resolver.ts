import { DNSPacket } from "./packet.ts";

export class DNSResolver {
  private servers: string[];
  private timeout: number;

  constructor(servers = ['8.8.8.8', '8.8.4.4', '1.1.1.1']) {
    this.servers = servers;
    this.timeout = 5000;
  }

  async resolve(packet: DNSPacket): Promise<DNSPacket> {
    for (const server of this.servers) {
      try {
        return await this.queryServer(server, packet);
      } catch (_err) {
        continue;
      }
    }
    throw new Error('All DNS servers failed');
  }

  private async queryServer(server: string, packet: DNSPacket): Promise<DNSPacket> {
    const query = packet.toBuffer();
    
    const conn = await Deno.connect({
      hostname: server,
      port: 53,
      transport: "tcp"
    });

    try {
      const lengthPrefix = new Uint8Array(2);
      lengthPrefix[0] = (query.length >> 8) & 0xFF;
      lengthPrefix[1] = query.length & 0xFF;
      
      const tcpQuery = new Uint8Array(lengthPrefix.length + query.length);
      tcpQuery.set(lengthPrefix);
      tcpQuery.set(query, lengthPrefix.length);
      
      await conn.write(tcpQuery);
      
      const lengthBuffer = new Uint8Array(2);
      await conn.read(lengthBuffer);
      const responseLength = (lengthBuffer[0] << 8) | lengthBuffer[1];
      
      const response = new Uint8Array(responseLength);
      const result = await Promise.race([
        conn.read(response),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('DNS query timeout')), this.timeout)
        )
      ]);

      if (!result) throw new Error('No response');
      
      const responsePacket = new DNSPacket(response.slice(0, result)).parse();
      return responsePacket;
    } finally {
      conn.close();
    }
  }
}
