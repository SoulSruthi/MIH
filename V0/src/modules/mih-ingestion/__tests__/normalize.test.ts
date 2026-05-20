/**
 * Tests for mih-ingestion normalize + ingest (Spec 02 V0)
 * All Supabase calls are mocked with simple in-memory stubs.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  normalizePhoneE164,
  normalizeEmail,
  normalizeName,
  PhoneNormalizationError,
  mihIngest,
} from '../index.js';
import type { MihIngestDeps } from '../index.js';

// ---------------------------------------------------------------------------
// E.164 normalization tests
// ---------------------------------------------------------------------------

describe('normalizePhoneE164', () => {
  it('normalizes 10-digit Indian number with +91 prefix', () => {
    expect(normalizePhoneE164('9876543210')).toBe('+919876543210');
  });

  it('strips spaces and passes through valid E.164', () => {
    expect(normalizePhoneE164('+91 98765 43210')).toBe('+919876543210');
  });

  it('strips dashes from phone number', () => {
    expect(normalizePhoneE164('+91-9876-543-210')).toBe('+919876543210');
  });

  it('handles 11-digit number with leading 0', () => {
    expect(normalizePhoneE164('09876543210')).toBe('+919876543210');
  });

  it('handles 12-digit number (country code without +)', () => {
    expect(normalizePhoneE164('919876543210')).toBe('+919876543210');
  });

  it('passes through non-Indian E.164', () => {
    expect(normalizePhoneE164('+14155552671')).toBe('+14155552671');
  });

  it('throws PhoneNormalizationError for too-short input', () => {
    expect(() => normalizePhoneE164('123')).toThrow(PhoneNormalizationError);
  });

  it('throws PhoneNormalizationError for too-long input', () => {
    expect(() => normalizePhoneE164('12345678901234567')).toThrow(PhoneNormalizationError);
  });

  it('throws PhoneNormalizationError for empty string', () => {
    expect(() => normalizePhoneE164('')).toThrow(PhoneNormalizationError);
  });
});

// ---------------------------------------------------------------------------
// Email normalization tests
// ---------------------------------------------------------------------------

describe('normalizeEmail', () => {
  it('lowercases email', () => {
    expect(normalizeEmail('Ravi@EXAMPLE.COM')).toBe('ravi@example.com');
  });

  it('trims whitespace', () => {
    expect(normalizeEmail('  ravi@example.com  ')).toBe('ravi@example.com');
  });

  it('returns null for empty string', () => {
    expect(normalizeEmail('')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(normalizeEmail(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizeEmail(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Name normalization tests
// ---------------------------------------------------------------------------

describe('normalizeName', () => {
  it('trims whitespace', () => {
    expect(normalizeName('  Ravi Kumar  ')).toBe('Ravi Kumar');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeName('Ravi   Kumar')).toBe('Ravi Kumar');
  });

  it('returns null for empty string', () => {
    expect(normalizeName('')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(normalizeName(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mihIngest tests
// ---------------------------------------------------------------------------

type MockSupabaseChain = {
  schema: (name: string) => MockSupabaseChain;
  from: (table: string) => MockSupabaseChain;
  insert: (data: unknown) => MockSupabaseChain;
  select: (fields?: string) => MockSupabaseChain;
  eq: (field: string, value: unknown) => MockSupabaseChain;
  single: () => Promise<{ data: { id: string } | null; error: { code?: string; message: string } | null }>;
};

function buildMockSupabase(overrides: {
  insertResult?: { data: { id: string } | null; error: { code?: string; message: string } | null };
  lookupResult?: { data: { id: string } | null; error: { code?: string; message: string } | null };
}): { supabaseAdmin: MockSupabaseChain; stores: { id: string }[] } {
  const stores: { id: string }[] = [];
  const insertResult = overrides.insertResult ?? { data: { id: 'inbox-new-123' }, error: null };
  const lookupResult = overrides.lookupResult ?? { data: null, error: null };

  let _mode: 'insert' | 'select' = 'select';

  const chain: MockSupabaseChain = {
    schema: () => chain,
    from: () => chain,
    insert: (data: unknown) => {
      _mode = 'insert';
      stores.push(data as { id: string });
      return chain;
    },
    select: () => chain,
    eq: () => chain,
    single: () => {
      if (_mode === 'insert') {
        _mode = 'select';
        return Promise.resolve(insertResult);
      }
      return Promise.resolve(lookupResult);
    },
  };

  return { supabaseAdmin: chain, stores };
}

describe('mihIngest', () => {
  it('missing phone → normalize_error', async () => {
    const { supabaseAdmin } = buildMockSupabase({});
    const result = await mihIngest(
      { phone: '', ingestionPath: 'webform', rawPayload: {} },
      'org-1',
      { supabaseAdmin: supabaseAdmin as unknown as MihIngestDeps['supabaseAdmin'] },
    );
    expect(result.status).toBe('normalize_error');
  });

  it('invalid phone → normalize_error', async () => {
    const { supabaseAdmin } = buildMockSupabase({});
    const result = await mihIngest(
      { phone: 'abc', ingestionPath: 'webform', rawPayload: {} },
      'org-1',
      { supabaseAdmin: supabaseAdmin as unknown as MihIngestDeps['supabaseAdmin'] },
    );
    expect(result.status).toBe('normalize_error');
  });

  it('valid phone → inserted with rawInboxId', async () => {
    const { supabaseAdmin } = buildMockSupabase({
      insertResult: { data: { id: 'inbox-abc' }, error: null },
    });
    const result = await mihIngest(
      { phone: '9876543210', ingestionPath: 'webform', rawPayload: { source: 'test' } },
      'org-1',
      { supabaseAdmin: supabaseAdmin as unknown as MihIngestDeps['supabaseAdmin'] },
    );
    expect(result.status).toBe('inserted');
    if (result.status === 'inserted') {
      expect(result.rawInboxId).toBe('inbox-abc');
    }
  });

  it('duplicate external_id → idempotent duplicate_external_id return', async () => {
    const { supabaseAdmin } = buildMockSupabase({
      insertResult: { data: null, error: { code: '23505', message: 'duplicate key' } },
      lookupResult: { data: { id: 'inbox-existing' }, error: null },
    });

    const result = await mihIngest(
      {
        phone: '9876543210',
        externalId: 'ext-123',
        connectorId: 'conn-abc',
        ingestionPath: 'webhook',
        rawPayload: {},
      },
      'org-1',
      { supabaseAdmin: supabaseAdmin as unknown as MihIngestDeps['supabaseAdmin'] },
    );

    expect(result.status).toBe('duplicate_external_id');
    if (result.status === 'duplicate_external_id') {
      expect(result.rawInboxId).toBe('inbox-existing');
    }
  });

  it('emits event after successful insert', async () => {
    const { supabaseAdmin } = buildMockSupabase({
      insertResult: { data: { id: 'inbox-emit-test' }, error: null },
    });
    const emitLeadIngested = vi.fn().mockResolvedValue(undefined);

    await mihIngest(
      { phone: '9876543210', ingestionPath: 'manual', rawPayload: {} },
      'org-1',
      {
        supabaseAdmin: supabaseAdmin as unknown as MihIngestDeps['supabaseAdmin'],
        emitLeadIngested,
      },
    );

    expect(emitLeadIngested).toHaveBeenCalledWith('inbox-emit-test', 'org-1');
  });

  it('does not emit event on duplicate', async () => {
    const { supabaseAdmin } = buildMockSupabase({
      insertResult: { data: null, error: { code: '23505', message: 'dup' } },
      lookupResult: { data: { id: 'inbox-dup' }, error: null },
    });
    const emitLeadIngested = vi.fn();

    await mihIngest(
      { phone: '9876543210', externalId: 'ext-dup', ingestionPath: 'webhook', rawPayload: {} },
      'org-1',
      {
        supabaseAdmin: supabaseAdmin as unknown as MihIngestDeps['supabaseAdmin'],
        emitLeadIngested,
      },
    );

    expect(emitLeadIngested).not.toHaveBeenCalled();
  });
});
