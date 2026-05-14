import { createHmac, timingSafeEqual } from 'crypto';

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verifies an HMAC-SHA256 webhook signature.
 *
 * @param body      Raw request body (Buffer or string)
 * @param secret    Shared HMAC secret (plaintext, decrypted at call site)
 * @param signature Vendor-provided signature (hex string, may include prefix like 'sha256=')
 * @param timestamp Unix epoch seconds from the request header (0 to skip timestamp check)
 */
export function verifyHmacSignature(
  body: Buffer | string,
  secret: string,
  signature: string,
  timestamp = 0,
): boolean {
  if (timestamp > 0) {
    const ageMs = Date.now() - timestamp * 1000;
    if (Math.abs(ageMs) > TIMESTAMP_TOLERANCE_MS) return false;
  }

  const raw = signature.replace(/^sha256=/, '');
  const expected = createHmac('sha256', secret)
    .update(typeof body === 'string' ? Buffer.from(body) : body)
    .digest('hex');

  try {
    return timingSafeEqual(Buffer.from(raw, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    // Different length buffers — reject
    return false;
  }
}

/** Generates an HMAC-SHA256 signature for outbound webhooks (MIH → CRM). */
export function signPayload(body: Buffer | string, secret: string): string {
  return createHmac('sha256', secret)
    .update(typeof body === 'string' ? Buffer.from(body) : body)
    .digest('hex');
}
