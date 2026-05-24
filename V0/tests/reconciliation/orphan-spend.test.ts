/**
 * Tests for orphan spend detection logic (orphan-spend-detection.ts)
 *
 * The inngest function calls getSupabaseAdmin(), deduplicateItem(), and createItem()
 * internally. We mock those modules and test the core detection logic by
 * exercising the stub-wired data paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory Supabase stub
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
    let _headMode = false;
    let _countExact = false;

    const self = {
      select: (_fields = '*', opts?: { count?: string; head?: boolean }) => {
        if (opts?.count === 'exact') _countExact = true;
        if (opts?.head) _headMode = true;
        return self;
      },
      insert: (data: MockRow | MockRow[]) => { _insertData = data; return self; },
      upsert: (data: MockRow | MockRow[], _opts?: unknown) => { _insertData = data; return self; },
      update: (_data: MockRow) => self,
      delete: () => self,
      eq: (field: string, value: unknown) => { _filters.push({ field, op: 'eq', value }); return self; },
      not: (_f: string, _op: string, _v: unknown) => self,
      is: (_f: string, _v: unknown) => self,
      in: (_f: string, _v: unknown) => self,
      gte: (_f: string, _v: unknown) => self,
      lte: (_f: string, _v: unknown) => self,
      gt: (_f: string, _v: unknown) => self,
      lt: (_f: string, _v: unknown) => self,
      limit: (_n: number) => self,
      order: () => self,
      maybeSingle: () => { _singleMode = true; return self; },
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

        // SELECT with count
        let rows = [...store];
        for (const { field, value } of _filters) {
          rows = rows.filter(r => r[field] === value);
        }

        if (_countExact) {
          return resolve({ data: _headMode ? null : rows, error: null, count: rows.length });
        }

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
// Track createItem calls for assertion
// ---------------------------------------------------------------------------
const createdItems: unknown[] = [];

vi.mock('../../src/lib/supabase-admin.js', () => ({
  getSupabaseAdmin: () => _stubInstance,
}));

vi.mock('../../src/modules/reconciliation/queue.js', () => ({
  deduplicateItem: async (orgId: string, itemType: string, _clusterId?: string, originEventId?: string) => {
    // Return existing open item only when _existingOriginId is set
    if (_existingOriginId && originEventId === _existingOriginId) {
      return { id: 'existing-item', org_id: orgId, item_type: itemType, state: 'open' };
    }
    return null;
  },
  createItem: async (input: unknown) => {
    createdItems.push(input);
    return { id: crypto.randomUUID(), ...(input as Record<string, unknown>) };
  },
}));

let _stubInstance: ReturnType<typeof createSupabaseStub>;
let _existingOriginId: string | null = null;

// Import AFTER mock declarations
const { orphanSpendDetectionFunction } = await import('../../src/inngest/functions/orphan-spend-detection.js');

// ---------------------------------------------------------------------------
// Helper to run the inngest function handler directly
// ---------------------------------------------------------------------------

async function runOrphanDetection(stub: ReturnType<typeof createSupabaseStub>) {
  _stubInstance = stub;
  const handler = (orphanSpendDetectionFunction as any).handler ?? (orphanSpendDetectionFunction as any).fn;
  const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };

  if (typeof handler === 'function') {
    return handler({ logger });
  }

  // Inngest v4 stores the handler differently — extract via internal structure
  // The function exposes an 'fn' or we call the run method
  const fnDef = orphanSpendDetectionFunction as any;
  if (fnDef.run) {
    return fnDef.run({ logger });
  }
  throw new Error('Cannot extract handler from inngest function');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Orphan Spend Detection Logic', () => {
  beforeEach(() => {
    createdItems.length = 0;
    _existingOriginId = null;
    _stubInstance = createSupabaseStub();
  });

  // -------------------------------------------------------------------------
  // Helper to seed a scenario in the stub
  // -------------------------------------------------------------------------
  function seedScenario(stub: ReturnType<typeof createSupabaseStub>, options: {
    orgId: string;
    sourceId: string;
    spendPaise: number;
    bookingsCount: number;
    leadsCount: number;
  }) {
    // Seed spend_entries
    stub.stores.set('spend_entries', [{
      id: crypto.randomUUID(),
      org_id: options.orgId,
      source_id: options.sourceId,
      amount_paise: options.spendPaise,
      period_start: '2026-04-24',
      period_end: '2026-05-23',
    }]);

    // Seed attribution_results (bookings)
    const bookings: MockRow[] = [];
    for (let i = 0; i < options.bookingsCount; i++) {
      bookings.push({
        id: crypto.randomUUID(),
        org_id: options.orgId,
        winning_source_id: options.sourceId,
        created_at: new Date().toISOString(),
      });
    }
    stub.stores.set('attribution_results', bookings);

    // Seed raw_leads
    const leads: MockRow[] = [];
    for (let i = 0; i < options.leadsCount; i++) {
      leads.push({
        id: crypto.randomUUID(),
        org_id: options.orgId,
        source_id: options.sourceId,
        ingested_at: new Date().toISOString(),
      });
    }
    stub.stores.set('raw_leads', leads);
  }

  // -------------------------------------------------------------------------
  // >₹50K spend + 0 bookings + leads > 0 → creates reconciliation item
  // -------------------------------------------------------------------------
  it('creates a reconciliation item when spend >₹50K, 0 bookings, leads > 0', async () => {
    seedScenario(_stubInstance, {
      orgId: 'org-1',
      sourceId: 'src-orphan',
      spendPaise: 6_000_000, // ₹60K
      bookingsCount: 0,
      leadsCount: 5,
    });

    await runOrphanDetection(_stubInstance);

    expect(createdItems).toHaveLength(1);
    const item = createdItems[0] as Record<string, unknown>;
    expect(item.item_type).toBe('orphan_spend_investigation');
    expect(item.org_id).toBe('org-1');
    const ctx = item.context as Record<string, unknown>;
    expect(ctx.source_id).toBe('src-orphan');
    expect((ctx.total_spend_paise as number)).toBeGreaterThan(5_000_000);
  });

  // -------------------------------------------------------------------------
  // <₹50K spend → does NOT create item (below threshold)
  // -------------------------------------------------------------------------
  it('does NOT create item when spend is below ₹50K threshold', async () => {
    seedScenario(_stubInstance, {
      orgId: 'org-2',
      sourceId: 'src-low',
      spendPaise: 4_000_000, // ₹40K
      bookingsCount: 0,
      leadsCount: 3,
    });

    await runOrphanDetection(_stubInstance);

    expect(createdItems).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Bookings > 0 → does NOT create item (spend has returns)
  // -------------------------------------------------------------------------
  it('does NOT create item when source has bookings', async () => {
    seedScenario(_stubInstance, {
      orgId: 'org-3',
      sourceId: 'src-booked',
      spendPaise: 8_000_000, // ₹80K
      bookingsCount: 2,
      leadsCount: 10,
    });

    await runOrphanDetection(_stubInstance);

    expect(createdItems).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Leads = 0 → does NOT create item (no evidence of any activity)
  // -------------------------------------------------------------------------
  it('does NOT create item when source has no leads', async () => {
    seedScenario(_stubInstance, {
      orgId: 'org-4',
      sourceId: 'src-noleads',
      spendPaise: 10_000_000, // ₹100K
      bookingsCount: 0,
      leadsCount: 0,
    });

    await runOrphanDetection(_stubInstance);

    expect(createdItems).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Deduplication: existing open item → no duplicate created
  // -------------------------------------------------------------------------
  it('does NOT create duplicate item when open item already exists for source', async () => {
    const sourceId = 'src-dup';
    _existingOriginId = sourceId; // cause deduplicateItem mock to return existing

    seedScenario(_stubInstance, {
      orgId: 'org-5',
      sourceId,
      spendPaise: 7_000_000,
      bookingsCount: 0,
      leadsCount: 4,
    });

    await runOrphanDetection(_stubInstance);

    // deduplicateItem returned existing → no new item
    expect(createdItems).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Multiple sources: only qualifying ones get items
  // -------------------------------------------------------------------------
  it('creates items only for qualifying sources when multiple sources exist', async () => {
    // Two spend entries for different sources
    _stubInstance.stores.set('spend_entries', [
      { id: crypto.randomUUID(), org_id: 'org-6', source_id: 'src-big', amount_paise: 8_000_000, period_start: '2026-04-24', period_end: '2026-05-23' },
      { id: crypto.randomUUID(), org_id: 'org-6', source_id: 'src-small', amount_paise: 2_000_000, period_start: '2026-04-24', period_end: '2026-05-23' },
    ]);
    // Leads for both, no bookings for either
    _stubInstance.stores.set('raw_leads', [
      { id: crypto.randomUUID(), org_id: 'org-6', source_id: 'src-big', ingested_at: new Date().toISOString() },
      { id: crypto.randomUUID(), org_id: 'org-6', source_id: 'src-small', ingested_at: new Date().toISOString() },
    ]);
    _stubInstance.stores.set('attribution_results', []);

    await runOrphanDetection(_stubInstance);

    // Only src-big (₹80K > ₹50K) should trigger an item
    expect(createdItems).toHaveLength(1);
    const item = createdItems[0] as Record<string, unknown>;
    const ctx = item.context as Record<string, unknown>;
    expect(ctx.source_id).toBe('src-big');
  });
});
