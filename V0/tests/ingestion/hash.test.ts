import { describe, it, expect } from 'vitest';
import { computePayloadHash } from '../../src/modules/ingestion/hash.js';

const BASE = {
  sourceId: 'src-1',
  phoneE164: '+919876543210',
  email: 'ravi@example.com',
  name: 'Ravi Kumar',
  sourceReceivedAt: new Date('2026-05-14T10:00:00.000Z'),
};

describe('computePayloadHash', () => {
  it('produces a 64-char hex string', () => {
    const h = computePayloadHash(BASE);
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic — same inputs produce same hash', () => {
    expect(computePayloadHash(BASE)).toBe(computePayloadHash({ ...BASE }));
  });

  it('different phone → different hash', () => {
    expect(computePayloadHash(BASE)).not.toBe(computePayloadHash({ ...BASE, phoneE164: '+919876543211' }));
  });

  it('different source → different hash', () => {
    expect(computePayloadHash(BASE)).not.toBe(computePayloadHash({ ...BASE, sourceId: 'src-2' }));
  });

  it('email=undefined vs email=value → different hash', () => {
    const withEmail = computePayloadHash(BASE);
    const withoutEmail = computePayloadHash({ ...BASE, email: undefined });
    expect(withEmail).not.toBe(withoutEmail);
  });

  it('different timestamp → different hash', () => {
    const h1 = computePayloadHash(BASE);
    const h2 = computePayloadHash({ ...BASE, sourceReceivedAt: new Date('2026-05-15T10:00:00.000Z') });
    expect(h1).not.toBe(h2);
  });
});
