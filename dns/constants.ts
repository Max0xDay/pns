export const DNS_PORT = 53;

export const DNS_TYPES = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  PTR: 12,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  SRV: 33,
  ANY: 255
} as const;

export const DNS_CLASSES = {
  IN: 1,
  CS: 2,
  CH: 3,
  HS: 4,
  ANY: 255
} as const;

export const DNS_RCODES = {
  NOERROR: 0,
  FORMERR: 1,
  SERVFAIL: 2,
  NXDOMAIN: 3,
  NOTIMP: 4,
  REFUSED: 5
} as const;

export type DNSType = keyof typeof DNS_TYPES;
export type DNSClass = keyof typeof DNS_CLASSES;
export type DNSRCode = keyof typeof DNS_RCODES;
