import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ingest } from '../../src/modules/ingestion/index.js';
import type { RawLeadInput } from '../../src/modules/connectors/_kernel/types.js';
import type { IngestDeps } from '../../src/modules/ingestion/index.js';

function makeInput(overrides: Partial<RawLeadInput> = {}): RawLeadInput {
  return {
    sourceExternalId: 'ext-123',
    phoneE164: '9876543210',   // un-normalized — ingest should normalize
    email: 'Ravi@EXAMPLE.COM',
    name: 'Ravi Kumar',
    sourceReceivedAt: new Date(Date.now() - 60_000),
    rawPayload: { test: true },
    ...overrides,
  };
}

function makeDeps(overrides: Partial<IngestDeps> = {}): IngestDeps {
  const insertMock = vi.fn().mockReturnValue({
    select: () => ({ single: () => Promise.resolve({ data: { id: 'raw-lead-uuid' }, error: null }) }),
  });
  return {
    supabaseAdmin: {
      from: vi.fn().mockReturnValue({ insert: insertMock }),
    } as never,
    emitLeadIngested: vi.fn().mockResolvedValue(undefined),
    writeDlq: vi.fn().mockResolvedValue(undefined),
    requestId: 'req-test-1',
    ...overrides,
  };
}

describe('ingest — unit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns inserted with rawLeadId on success', async () => {
    const insertData = { id: 'raw-lead-uuid' };
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: () => ({ single: () => Promise.resolve({ data: insertData, error: null }) }),
        }),
      }),
    } as never;

    const result = await ingest(makeInput(), 'src-1', 'org-1', { supabaseAdmin });
    expect(result.status).toBe('inserted');
    if (result.status === 'inserted') expect(result.rawLeadId).toBe('raw-lead-uuid');
  });

  it('normalizes phone to E.164 before insert', async () => {
    const insertMock = vi.fn().mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: 'x' }, error: null }) }),
    });
    const supabaseAdmin = { from: vi.fn().mockReturnValue({ insert: insertMock }) } as never;

    await ingest(makeInput({ phoneE164: '9876543210' }), 'src-1', 'org-1', { supabaseAdmin });

    const row = insertMock.mock.calls[0][0];
    expect(row.phone_e164).toBe('+919876543210');
  });

  it('normalizes email to lowercase before insert', async () => {
    const insertMock = vi.fn().mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: 'x' }, error: null }) }),
    });
    const supabaseAdmin = { from: vi.fn().mockReturnValue({ insert: insertMock }) } as never;

    await ingest(makeInput({ email: 'RAVI@EXAMPLE.COM' }), 'src-1', 'org-1', { supabaseAdmin });

    const row = insertMock.mock.calls[0][0];
    expect(row.email).toBe('ravi@example.com');
  });

  it('returns duplicate_external_id on 23505 source_external_id conflict', async () => {
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: () => ({
            single: () => Promise.resolve({
              data: null,
              error: { code: '23505', message: 'duplicate key value violates unique constraint "sources_source_external_id"' },
            }),
          }),
        }),
      }),
    } as never;

    const result = await ingest(makeInput(), 'src-1', 'org-1', { supabaseAdmin });
    expect(result.status).toBe('duplicate_external_id');
  });

  it('returns duplicate_hash on 23505 payload_hash conflict', async () => {
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: () => ({
            single: () => Promise.resolve({
              data: null,
              error: { code: '23505', message: 'duplicate key value violates unique constraint "raw_leads_payload_hash"' },
            }),
          }),
        }),
      }),
    } as never;

    const result = await ingest(makeInput(), 'src-1', 'org-1', { supabaseAdmin });
    expect(result.status).toBe('duplicate_hash');
  });

  it('returns normalize_error and writes DLQ for invalid phone', async () => {
    const writeDlq = vi.fn().mockResolvedValue(undefined);
    const supabaseAdmin = { from: vi.fn() } as never;

    const result = await ingest(
      makeInput({ phoneE164: '123' }),
      'src-1', 'org-1',
      { supabaseAdmin, writeDlq },
    );

    expect(result.status).toBe('normalize_error');
    expect(writeDlq).toHaveBeenCalledWith(expect.objectContaining({ failure_stage: 'normalize' }));
  });

  it('returns validation_error and writes DLQ for name < 2 chars', async () => {
    const writeDlq = vi.fn().mockResolvedValue(undefined);
    const supabaseAdmin = { from: vi.fn() } as never;

    const result = await ingest(
      makeInput({ name: 'X' }),
      'src-1', 'org-1',
      { supabaseAdmin, writeDlq },
    );

    expect(result.status).toBe('validation_error');
    expect(writeDlq).toHaveBeenCalled();
  });

  it('calls emitLeadIngested after successful insert', async () => {
    const emitLeadIngested = vi.fn().mockResolvedValue(undefined);
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: () => ({ single: () => Promise.resolve({ data: { id: 'raw-1' }, error: null }) }),
        }),
      }),
    } as never;

    await ingest(makeInput(), 'src-1', 'org-1', { supabaseAdmin, emitLeadIngested });
    expect(emitLeadIngested).toHaveBeenCalledWith('raw-1', 'org-1', expect.any(String));
  });

  it('does NOT call emitLeadIngested on duplicate', async () => {
    const emitLeadIngested = vi.fn();
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: () => ({
            single: () => Promise.resolve({
              data: null,
              error: { code: '23505', message: 'source_external_id' },
            }),
          }),
        }),
      }),
    } as never;

    await ingest(makeInput(), 'src-1', 'org-1', { supabaseAdmin, emitLeadIngested });
    expect(emitLeadIngested).not.toHaveBeenCalled();
  });
});
