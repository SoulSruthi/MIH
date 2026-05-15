import { promises as dns } from 'dns';
import { URL } from 'url';

const PRIVATE_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fd/,
  /^localhost$/i,
];

export class SsrfError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'SsrfError';
  }
}

export function isPrivateIp(ip: string): boolean {
  return PRIVATE_RANGES.some((r) => r.test(ip));
}

export async function guardCrmUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfError(`Invalid CRM base URL: ${rawUrl}`);
  }

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new SsrfError(`CRM URL must use http(s), got: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname;

  // Reject bare IP patterns without DNS lookup
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new SsrfError(`SSRF guard: private IP rejected: ${hostname}`);
    }
    return;
  }

  // Resolve DNS and check each resolved address
  let addresses: string[];
  try {
    addresses = await dns.resolve4(hostname).catch(() => dns.resolve6(hostname));
  } catch {
    throw new SsrfError(`SSRF guard: DNS resolution failed for: ${hostname}`);
  }

  for (const addr of addresses) {
    if (isPrivateIp(addr)) {
      throw new SsrfError(`SSRF guard: hostname ${hostname} resolved to private IP ${addr}`);
    }
  }
}
