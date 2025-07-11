import { DNS_TYPES, DNS_RCODES } from "./constants.ts";

export interface DNSHeader {
  id: number;
  qr: number;
  opcode: number;
  aa: number;
  tc: number;
  rd: number;
  ra: number;
  z: number;
  rcode: number;
  qdcount: number;
  ancount: number;
  nscount: number;
  arcount: number;
}

export interface DNSQuestion {
  name: string;
  type: number;
  class: number;
}

export interface DNSResourceRecord {
  name: string;
  type: number;
  class: number;
  ttl: number;
  rdlength?: number;
  rdata?: unknown;
  address?: string;
  domain?: string;
  priority?: number;
  exchange?: string;
  text?: string;
  raw?: Uint8Array;
}

export class DNSPacket {
  private buffer: Uint8Array;
  private view: DataView;
  private offset: number = 0;
  public header: DNSHeader = {} as DNSHeader;
  public questions: DNSQuestion[] = [];
  public answers: DNSResourceRecord[] = [];
  public authorities: DNSResourceRecord[] = [];
  public additionals: DNSResourceRecord[] = [];

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.view = new DataView(buffer.buffer);
  }

  parse(): DNSPacket {
    this.parseHeader();
    this.parseQuestions();
    this.parseResourceRecords();
    return this;
  }

  private parseHeader(): void {
    this.header.id = this.view.getUint16(0);
    const flags = this.view.getUint16(2);
    
    this.header.qr = (flags >> 15) & 1;
    this.header.opcode = (flags >> 11) & 15;
    this.header.aa = (flags >> 10) & 1;
    this.header.tc = (flags >> 9) & 1;
    this.header.rd = (flags >> 8) & 1;
    this.header.ra = (flags >> 7) & 1;
    this.header.z = (flags >> 4) & 7;
    this.header.rcode = flags & 15;
    
    this.header.qdcount = this.view.getUint16(4);
    this.header.ancount = this.view.getUint16(6);
    this.header.nscount = this.view.getUint16(8);
    this.header.arcount = this.view.getUint16(10);
    
    this.offset = 12;
  }

  private parseQuestions(): void {
    for (let i = 0; i < this.header.qdcount; i++) {
      const question: DNSQuestion = {
        name: this.parseName(),
        type: this.view.getUint16(this.offset),
        class: this.view.getUint16(this.offset + 2)
      };
      this.offset += 4;
      this.questions.push(question);
    }
  }

  private parseResourceRecords(): void {
    this.answers = this.parseRecords(this.header.ancount);
    this.authorities = this.parseRecords(this.header.nscount);
    this.additionals = this.parseRecords(this.header.arcount);
  }

  private parseRecords(count: number): DNSResourceRecord[] {
    const records: DNSResourceRecord[] = [];
    for (let i = 0; i < count; i++) {
      const record: DNSResourceRecord = {
        name: this.parseName(),
        type: this.view.getUint16(this.offset),
        class: this.view.getUint16(this.offset + 2),
        ttl: this.view.getUint32(this.offset + 4),
        rdlength: this.view.getUint16(this.offset + 8)
      };
      this.offset += 10;
      
      record.rdata = this.parseRData(record.type, record.rdlength!);
      Object.assign(record, record.rdata);
      records.push(record);
    }
    return records;
  }

  private parseName(): string {
    const parts: string[] = [];
    let jumped = false;
    let jumpOffset = -1;
    let count = 0;

    while (true) {
      if (count > 100) throw new Error('DNS name parsing loop detected');
      count++;

      const len = this.buffer[this.offset];
      
      if (len === 0) {
        this.offset++;
        break;
      }
      
      if ((len & 0xc0) === 0xc0) {
        if (!jumped) {
          jumpOffset = this.offset + 2;
        }
        const pointer = ((len & 0x3f) << 8) | this.buffer[this.offset + 1];
        this.offset = pointer;
        jumped = true;
        continue;
      }
      
      this.offset++;
      const part = new TextDecoder().decode(
        this.buffer.slice(this.offset, this.offset + len)
      );
      parts.push(part);
      this.offset += len;
    }
    
    if (jumped && jumpOffset !== -1) {
      this.offset = jumpOffset;
    }
    
    return parts.join('.');
  }

  private parseRData(type: number, length: number): unknown {
    const data: Record<string, unknown> = {};
    const start = this.offset;
    
    switch (type) {
      case DNS_TYPES.A: {
        data.address = `${this.buffer[this.offset]}.${this.buffer[this.offset + 1]}.${this.buffer[this.offset + 2]}.${this.buffer[this.offset + 3]}`;
        break;
      }
      case DNS_TYPES.AAAA: {
        const parts: string[] = [];
        for (let i = 0; i < 8; i++) {
          parts.push(this.view.getUint16(this.offset + i * 2).toString(16));
        }
        data.address = parts.join(':');
        break;
      }
      case DNS_TYPES.CNAME:
      case DNS_TYPES.NS:
      case DNS_TYPES.PTR: {
        data.domain = this.parseName();
        this.offset = start;
        break;
      }
      case DNS_TYPES.MX: {
        data.priority = this.view.getUint16(this.offset);
        this.offset += 2;
        data.exchange = this.parseName();
        this.offset = start;
        break;
      }
      case DNS_TYPES.TXT: {
        const texts: string[] = [];
        let txtOffset = 0;
        while (txtOffset < length) {
          const txtLen = this.buffer[this.offset + txtOffset];
          txtOffset++;
          const text = new TextDecoder().decode(
            this.buffer.slice(this.offset + txtOffset, this.offset + txtOffset + txtLen)
          );
          texts.push(text);
          txtOffset += txtLen;
        }
        data.text = texts.join('');
        break;
      }
      default: {
        data.raw = this.buffer.slice(this.offset, this.offset + length);
      }
    }
    
    this.offset = start + length;
    return data;
  }

  static createResponse(request: DNSPacket): DNSPacket {
    const buffer = new Uint8Array(512);
    const packet = new DNSPacket(buffer);
    packet.header = {
      id: request.header.id,
      qr: 1,
      opcode: request.header.opcode,
      aa: 0,
      tc: 0,
      rd: request.header.rd,
      ra: 1,
      z: 0,
      rcode: DNS_RCODES.NOERROR,
      qdcount: request.questions.length,
      ancount: 0,
      nscount: 0,
      arcount: 0
    };
    packet.questions = request.questions;
    packet.answers = [];
    return packet;
  }

  toBuffer(): Uint8Array {
    const buffers: Uint8Array[] = [];
    
    const header = new Uint8Array(12);
    const headerView = new DataView(header.buffer);
    
    headerView.setUint16(0, this.header.id);
    
    let flags = 0;
    flags |= (this.header.qr & 1) << 15;
    flags |= (this.header.opcode & 15) << 11;
    flags |= (this.header.aa & 1) << 10;
    flags |= (this.header.tc & 1) << 9;
    flags |= (this.header.rd & 1) << 8;
    flags |= (this.header.ra & 1) << 7;
    flags |= (this.header.z & 7) << 4;
    flags |= (this.header.rcode & 15);
    
    headerView.setUint16(2, flags);
    headerView.setUint16(4, this.questions.length);
    headerView.setUint16(6, this.answers.length);
    headerView.setUint16(8, this.authorities.length);
    headerView.setUint16(10, this.additionals.length);
    
    buffers.push(header);
    
    for (const question of this.questions) {
      buffers.push(this.encodeName(question.name));
      const qBuffer = new Uint8Array(4);
      const qView = new DataView(qBuffer.buffer);
      qView.setUint16(0, question.type);
      qView.setUint16(2, question.class);
      buffers.push(qBuffer);
    }
    
    for (const answer of this.answers) {
      buffers.push(this.encodeResourceRecord(answer));
    }
    
    for (const authority of this.authorities) {
      buffers.push(this.encodeResourceRecord(authority));
    }
    
    for (const additional of this.additionals) {
      buffers.push(this.encodeResourceRecord(additional));
    }
    
    return this.concatenateBuffers(buffers);
  }

  private encodeName(name: string): Uint8Array {
    const parts = name.split('.');
    const buffers: Uint8Array[] = [];
    
    for (const part of parts) {
      const encoded = new TextEncoder().encode(part);
      buffers.push(new Uint8Array([encoded.length]));
      buffers.push(encoded);
    }
    
    buffers.push(new Uint8Array([0]));
    return this.concatenateBuffers(buffers);
  }

  private encodeResourceRecord(record: DNSResourceRecord): Uint8Array {
    const buffers: Uint8Array[] = [];
    
    buffers.push(this.encodeName(record.name));
    
    const info = new Uint8Array(10);
    const infoView = new DataView(info.buffer);
    infoView.setUint16(0, record.type);
    infoView.setUint16(2, record.class);
    infoView.setUint32(4, record.ttl);
    
    let rdata: Uint8Array;
    switch (record.type) {
      case DNS_TYPES.A: {
        const parts = record.address!.split('.').map(Number);
        rdata = new Uint8Array(parts);
        break;
      }
      case DNS_TYPES.CNAME: {
        rdata = this.encodeName(record.domain || record.address || '');
        break;
      }
      default: {
        rdata = new Uint8Array(0);
      }
    }
    
    infoView.setUint16(8, rdata.length);
    buffers.push(info, rdata);
    
    return this.concatenateBuffers(buffers);
  }

  private concatenateBuffers(buffers: Uint8Array[]): Uint8Array {
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const buffer of buffers) {
      result.set(buffer, offset);
      offset += buffer.length;
    }
    
    return result;
  }
}
