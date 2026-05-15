import { describe, it, expect } from 'vitest';
import { verifyHmacSignature, signPayload } from '../../src/modules/connectors/_kernel/hmac.js';
import { createHmac } from 'crypto';

function makeSignature(body: string, secret: string): string {
  return createHmac('sha256', secret).update(Buffer.from(body)).digest('hex');
}

describe('HMAC signature verification', () => {
  const SECRET = 'test-secret-key';
  const BODY = JSON.stringify({ event: 'lead.submitted', phone: '+919876543210' });

  it('accepts a valid signature', () => {
    const sig = makeSignature(BODY, SECRET);
    expect(verifyHmacSignature(BODY, SECRET, sig)).toBe(true);
  });

  it('accepts signature with sha256= prefix', () => {
    const sig = `sha256=${makeSignature(BODY, SECRET)}`;
    expect(verifyHmacSignature(BODY, SECRET, sig)).toBe(true);
  });

  it('rejects tampered body', () => {
    const sig = makeSignature(BODY, SECRET);
    expect(verifyHmacSignature(BODY + 'x', SECRET, sig)).toBe(false);
  });

  it('rejects wrong secret', () => {
    const sig = makeSignature(BODY, 'wrong-secret');
    expect(verifyHmacSignature(BODY, SECRET, sig)).toBe(false);
  });

  it('rejects when timestamp is outside 5-minute window', () => {
    const sig = makeSignature(BODY, SECRET);
    const staleTs = Math.floor((Date.now() - 6 * 60 * 1000) / 1000);
    expect(verifyHmacSignature(BODY, SECRET, sig, staleTs)).toBe(false);
  });

  it('accepts when timestamp is within 5-minute window', () => {
    const sig = makeSignature(BODY, SECRET);
    const freshTs = Math.floor(Date.now() / 1000);
    expect(verifyHmacSignature(BODY, SECRET, sig, freshTs)).toBe(true);
  });

  it('Buffer body produces same result as string body', () => {
    const sig = makeSignature(BODY, SECRET);
    expect(verifyHmacSignature(Buffer.from(BODY), SECRET, sig)).toBe(true);
  });
});

describe('signPayload', () => {
  it('produces a hex signature verifiable by verifyHmacSignature', () => {
    const SECRET = 'outbound-secret';
    const PAYLOAD = JSON.stringify({ lead_id: 'abc-123' });
    const sig = signPayload(PAYLOAD, SECRET);
    expect(verifyHmacSignature(PAYLOAD, SECRET, sig)).toBe(true);
  });
});
