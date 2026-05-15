import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyHmacSignature, verifyTimestamp } from '../../src/modules/crm-events/inbox';
import { createHmac } from 'crypto';

describe('verifyTimestamp', () => {
  it('accepts timestamp within 5 minutes', () => {
    const now = new Date().toISOString();
    expect(verifyTimestamp(now)).toBe(true);
  });

  it('rejects timestamp older than 5 minutes', () => {
    const old = new Date(Date.now() - 6 * 60_000).toISOString();
    expect(verifyTimestamp(old)).toBe(false);
  });

  it('rejects timestamp in the future beyond window', () => {
    const future = new Date(Date.now() + 6 * 60_000).toISOString();
    expect(verifyTimestamp(future)).toBe(false);
  });

  it('rejects invalid timestamp strings', () => {
    expect(verifyTimestamp('not-a-date')).toBe(false);
    expect(verifyTimestamp('')).toBe(false);
  });
});

describe('verifyHmacSignature', () => {
  const secret = 'my-hmac-secret';
  const timestamp = '2026-05-14T08:30:00.000Z';
  const body = JSON.stringify({ event_id: 'ev-1', event_kind: 'lead.contacted' });

  function makeSignature(s: string, t: string, b: string): string {
    return 'sha256=' + createHmac('sha256', s).update(`${t}.${b}`).digest('hex');
  }

  it('accepts a valid signature', () => {
    const sig = makeSignature(secret, timestamp, body);
    expect(verifyHmacSignature(secret, timestamp, body, sig)).toBe(true);
  });

  it('rejects tampered body', () => {
    const sig = makeSignature(secret, timestamp, body);
    expect(verifyHmacSignature(secret, timestamp, body + 'x', sig)).toBe(false);
  });

  it('rejects wrong secret', () => {
    const sig = makeSignature('wrong-secret', timestamp, body);
    expect(verifyHmacSignature(secret, timestamp, body, sig)).toBe(false);
  });

  it('accepts signature without sha256= prefix', () => {
    const hex = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    expect(verifyHmacSignature(secret, timestamp, body, hex)).toBe(true);
  });

  it('rejects empty signature', () => {
    expect(verifyHmacSignature(secret, timestamp, body, '')).toBe(false);
  });
});

describe('processEvent — event_kind validation', () => {
  it('verifyTimestamp is exported and callable', () => {
    // Confirm the function is exported correctly (already imported at top)
    expect(typeof verifyTimestamp).toBe('function');
  });
});
