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
        const result = await this.queryServer(server, packet);
        return result;
      } catch (err) {
        console.error(`DNS server ${server} failed: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
    }
    throw new Error('All DNS servers failed');
  }

  private async queryServer(server: string, packet: DNSPacket): Promise<DNSPacket> {
    const cleanQuery = DNSPacket.createResponse(packet);
    cleanQuery.header.qr = 0; //query response
    cleanQuery.header.ra = 0; // Recursion available
    cleanQuery.header.ancount = 0;
    cleanQuery.header.nscount = 0;
    cleanQuery.header.arcount = 0;
    cleanQuery.answers = [];
    cleanQuery.authorities = [];
    cleanQuery.additionals = [];
    
    const query = cleanQuery.toBuffer();
    
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
