/**
 * Tests for contract-amortizer.ts — amortizeContract()
 *
 * Pure-DB interaction tests using the in-memory Supabase stub.
 * No real network calls. The function upserts spend_entries.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { amortizeContract } from '../../src/modules/roi-reporting/contract-amortizer.js';
import type { SpendContract } from '../../src/modules/roi-reporting/types.js';

// ---------------------------------------------------------------------------
// In-memory Supabase stub (matches the canonical pattern)
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;
type TableStore = Map<string, MockRow[]>;

function createSupabaseStub(stores: TableStore = new Map()) {
  const getStore = (table: string): MockRow[] => {
    if (!stores.has(table)) stores.set(table, []);
    return stores.get(table)!;
  };

  const buildChain = (table: string) => {
    let _filters: Array<{ field: string; op: string; value: unknown }> = [];
    let _insertData: MockRow | MockRow[] | null = null;
    let _singleMode = false;
    let _updateData: MockRow | null = null;
    let _limit: number | null = null;
    let _gtFilters: Array<{ field: string; value: unknown }> = [];
    let _deleteMode = false;

    const self = {
      select: (_fields = '*') => self,
      insert: (data: MockRow | MockRow[]) => { _insertData = data; return self; },
      upsert: (data: MockRow | MockRow[], _opts?: unknown) => { _insertData = data; return self; },
      update: (data: MockRow) => { _updateData = data; return self; },
      delete: () => { _deleteMode = true; return self; },
      eq: (field: string, value: unknown) => { _filters.push({ field, op: 'eq', value }); return self; },
      not: (_f: string, _op: string, _v: unknown) => self,
      is: (_f: string, _v: unknown) => self,
      in: (_f: string, _v: unknown) => self,
      gt: (field: string, value: unknown) => { _gtFilters.push({ field, value }); return self; },
      limit: (n: number) => { _limit = n; return self; },
      order: () => self,
      single: () => { _singleMode = true; return self; },
      then: (resolve: (v: { data: unknown; error: null | { message: string }; count?: number }) => void) => {
        const store = getStore(table);

        if (_insertData !== null) {
          const rows = Array.isArray(_insertData) ? _insertData : [_insertData];
          const inserted: MockRow[] = [];
          for (const row of rows) {
            const newRow = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row };
            store.push(newRow);
            inserted.push(newRow);
          }
          const result = _singleMode ? inserted[0] ?? null : inserted;
          return resolve({ data: result, error: null });
        }

        if (_updateData !== null) {
          let rows = [...store];
          for (const { field, value } of _filters) {
            rows = rows.filter(r => r[field] === value);
          }
          rows.forEach(r => Object.assign(r, _updateData));
          const result = _singleMode ? rows[0] ?? null : rows;
          return resolve({ data: result, error: null });
        }

        if (_deleteMode) {
          let toDelete = [...store];
          for (const { field, value } of _filters) {
            toDelete = toDelete.filter(r => r[field] === value);
          }
          for (const { field, value } of _gtFilters) {
            toDelete = toDelete.filter(r => (r[field] as string) > (value as string));
          }
          const deleteIds = new Set(toDelete.map(r => r.id));
          const remaining = store.filter(r => !deleteIds.has(r.id));
          stores.set(table, remaining);
          return resolve({ data: null, error: null, count: deleteIds.size });
        }

        // SELECT
        let rows = [...store];
        for (const { field, value } of _filters) {
          rows = rows.filter(r => r[field] === value);
        }
        if (_limit !== null) rows = rows.slice(0, _limit);
        const result = _singleMode ? rows[0] ?? null : rows;
        return resolve({ data: result, error: null });
      },
    };
    return self;
  };

  const schemaProxy = { from: (table: string) => buildChain(table) };
  return { schema: (_name: string) => schemaProxy, stores, from: (table: string) => buildChain(table) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContract(overrides: Partial<SpendContract> = {}): SpendContract {
  return {
    id: 'contract-001',
    org_id: 'org-test',
    project_id: 'proj-1',
    source_id: 'src-1',
    vendor_name: 'Test Vendor',
    total_amount_paise: 1_200_000, // ₹12,000
    amortization: 'monthly',
    contract_start: '2025-01-01',
    contract_end: '2025-12-31',
    is_active: true,
    terminated_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('amortizeContract', () => {
  let stub: ReturnType<typeof createSupabaseStub>;

  beforeEach(() => {
    stub = createSupabaseStub();
  });

  // -------------------------------------------------------------------------
  // Monthly amortization — 12 months for a 1-year contract
  // -------------------------------------------------------------------------
  it('creates exactly 12 entries for a full-year monthly contract', async () => {
    const contract = makeContract({
      total_amount_paise: 1_200_000,
      contract_start: '2025-01-01',
      contract_end: '2025-12-31',
      amortization: 'monthly',
    });

    const result = await amortizeContract(contract, stub as any);

    expect(result.entries_created).toBe(12);
    expect(result.entries).toHaveLength(12);
    const entries = stub.stores.get('spend_entries') ?? [];
    expect(entries).toHaveLength(12);
  });

  // -------------------------------------------------------------------------
  // Monthly amounts must sum to the total and distribute evenly
  // -------------------------------------------------------------------------
  it('distributes total_amount_paise evenly across 12 months (remainder on last)', async () => {
    // 1_200_001 paise — 1 paise remainder goes to last month
    const contract = makeContract({ total_amount_paise: 1_200_001, amortization: 'monthly' });

    const result = await amortizeContract(contract, stub as any);

    const total = result.entries.reduce((s, e) => s + e.amount_paise, 0);
    expect(total).toBe(1_200_001);

    // First 11 entries should each be Math.floor(1_200_001 / 12) = 100000
    const sorted = [...result.entries].sort((a, b) =>
      a.period_start.localeCompare(b.period_start),
    );
    for (let i = 0; i < 11; i++) {
      expect(sorted[i]!.amount_paise).toBe(100_000);
    }
    // Last entry gets the remainder: 100000 + 1 = 100001
    expect(sorted[11]!.amount_paise).toBe(100_001);
  });

  // -------------------------------------------------------------------------
  // Weekly amortization — correct number of weeks for a 28-day contract
  // -------------------------------------------------------------------------
  it('creates correct entries for weekly amortization over a 4-week contract', async () => {
    // Jan 6 (Monday) to Feb 2 (Sunday) = exactly 4 ISO weeks
    const contract = makeContract({
      total_amount_paise: 400_000,
      contract_start: '2025-01-06',
      contract_end: '2025-02-02',
      amortization: 'weekly',
    });

    const result = await amortizeContract(contract, stub as any);

    // Should have 4 weekly entries
    expect(result.entries_created).toBeGreaterThanOrEqual(4);
    const total = result.entries.reduce((s, e) => s + e.amount_paise, 0);
    expect(total).toBe(400_000);
  });

  // -------------------------------------------------------------------------
  // Idempotency: upsert behavior — calling twice shouldn't double-count
  // (the stub does append on upsert, but external_ref should be unique;
  //  we test that the function doesn't throw and returns correct counts on repeat)
  // -------------------------------------------------------------------------
  it('upsert call does not throw on second invocation and returns entry count', async () => {
    const contract = makeContract();

    const result1 = await amortizeContract(contract, stub as any);
    expect(result1.entries_created).toBe(12);

    // Second call (simulating idempotent re-run) — should not throw
    const result2 = await amortizeContract(contract, stub as any);
    expect(result2.entries_created).toBe(12);
  });

  // -------------------------------------------------------------------------
  // Zero total cost — creates 0-paise entries (one per month)
  // -------------------------------------------------------------------------
  it('creates entries with 0 amount_paise when total_amount_paise is 0', async () => {
    const contract = makeContract({ total_amount_paise: 0 });

    const result = await amortizeContract(contract, stub as any);

    expect(result.entries_created).toBe(12);
    result.entries.forEach(e => expect(e.amount_paise).toBe(0));
  });

  // -------------------------------------------------------------------------
  // Single-month contract (start == end month) → exactly 1 entry
  // -------------------------------------------------------------------------
  it('creates exactly 1 entry for a same-month contract', async () => {
    const contract = makeContract({
      contract_start: '2025-06-01',
      contract_end: '2025-06-30',
      total_amount_paise: 500_000,
    });

    const result = await amortizeContract(contract, stub as any);

    expect(result.entries_created).toBe(1);
    expect(result.entries[0]!.amount_paise).toBe(500_000);
    expect(result.entries[0]!.period_start).toBe('2025-06-01');
  });

  // -------------------------------------------------------------------------
  // one_time amortization — single full-span entry
  // -------------------------------------------------------------------------
  it('creates a single full-span entry for one_time amortization', async () => {
    const contract = makeContract({
      amortization: 'one_time',
      total_amount_paise: 999_999,
    });

    const result = await amortizeContract(contract, stub as any);

    expect(result.entries_created).toBe(1);
    expect(result.entries[0]!.amount_paise).toBe(999_999);
    expect(result.entries[0]!.external_ref).toContain('_full');
  });

  // -------------------------------------------------------------------------
  // Fields are populated correctly on each entry
  // -------------------------------------------------------------------------
  it('sets correct org_id, source_id, contract_id and ingestion_source on entries', async () => {
    const contract = makeContract({
      id: 'ctr-xyz',
      org_id: 'org-abc',
      source_id: 'src-99',
      total_amount_paise: 120_000,
      contract_start: '2025-01-01',
      contract_end: '2025-01-31',
    });

    const result = await amortizeContract(contract, stub as any);

    const entry = result.entries[0]!;
    expect(entry.org_id).toBe('org-abc');
    expect(entry.source_id).toBe('src-99');
    expect(entry.contract_id).toBe('ctr-xyz');
    expect(entry.ingestion_source).toBe('contract');
    expect(entry.entry_kind).toBe('recurring_amortized');
  });
});
