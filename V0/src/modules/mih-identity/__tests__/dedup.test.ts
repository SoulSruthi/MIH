/**
 * Tests for mih-identity dedup module (Spec 03 V0)
 * All Supabase calls are mocked with in-memory stubs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveMihDedup } from '../dedup.js';
import type { MihDedupDeps, MihRawInboxRef } from '../types.js';

// ---------------------------------------------------------------------------
// In-memory stub for Supabase (schema + from chaining)
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;
type TableStore = Map<string, MockRow[]>;

function createSupabaseStub(stores: TableStore = new Map()) {
  const getStore = (table: string): MockRow[] => {
    if (!stores.has(table)) stores.set(table, []);
    return stores.get(table)!;
  };

  const buildChain = (table: string) => {
    const chain: Record<string, unknown> = {};
    let _filters: Array<{ field: string; op: string; value: unknown }> = [];
    let _limit: number | null = null;
    let _orderField: string | null = null;
    let _insertData: MockRow | MockRow[] | null = null;
    let _updateData: MockRow | null = null;
    let _selectFields = '*';
    let _singleMode = false;
    let _inField: string | null = null;
    let _inValues: unknown[] = [];

    const self = {
      select: (fields = '*') => { _selectFields = fields; return self; },
      insert: (data: MockRow | MockRow[]) => { _insertData = data; return self; },
      update: (data: MockRow) => { _updateData = data; return self; },
      eq: (field: string, value: unknown) => { _filters.push({ field, op: 'eq', value }); return self; },
      gte: (field: string, value: unknown) => { _filters.push({ field, op: 'gte', value }); return self; },
      in: (field: string, values: unknown[]) => { _inField = field; _inValues = values; return self; },
      not: (_field: string, _op: string, _val: unknown) => self,
      is: (field: string, value: unknown) => { _filters.push({ field, op: 'is', value }); return self; },
      order: (field: string) => { _orderField = field; return self; },
      limit: (n: number) => { _limit = n; return self; },
      range: () => self,
      single: () => { _singleMode = true; return self; },
      // Terminal: then / awaited
      then: (resolve: (v: { data: unknown; error: null }) => void) => {
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
          const updated: MockRow[] = [];
          for (const row of store) {
            const match = _filters.every(({ field, op, value }) => {
              if (op === 'eq') return row[field] === value;
              return true;
            });
            if (match) {
              Object.assign(row, _updateData);
              updated.push(row);
            }
          }
          const result = _singleMode ? updated[0] ?? null : updated;
          return resolve({ data: result, error: null });
        }

        // SELECT
        let rows = [...store];
        for (const { field, op, value } of _filters) {
          rows = rows.filter((r) => {
            if (op === 'eq') return r[field] === value;
            if (op === 'gte') return String(r[field]) >= String(value);
            if (op === 'is') return value === null ? r[field] == null : r[field] === value;
            return true;
          });
        }

        if (_inField) {
          rows = rows.filter((r) => _inValues.includes(r[_inField!]));
        }

        if (_orderField) {
          rows = [...rows].sort((a, b) =>
            String(b[_orderField!]).localeCompare(String(a[_orderField!])),
          );
        }

        if (_limit !== null) rows = rows.slice(0, _limit);

        const result = _singleMode ? rows[0] ?? null : rows;
        return resolve({ data: result, error: null });
      },
    };
    Object.assign(chain, self);
    return chain;
  };

  const schemaProxy = {
    from: (table: string) => buildChain(table),
  };

  return {
    schema: (_schemaName: string) => schemaProxy,
    stores,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRawInbox(overrides: Partial<MihRawInboxRef> = {}): MihRawInboxRef {
  return {
    id: `inbox-${Math.random().toString(36).slice(2)}`,
    org_id: 'org-test',
    phone_e164: '+919876543210',
    email: 'ravi@example.com',
    name: 'Ravi Kumar',
    source_id: 'src-abc',
    source_received_at: '2026-01-01T10:00:00Z',
    ...overrides,
  };
}

function makeDeps(
  stub: ReturnType<typeof createSupabaseStub>,
  overrides: Partial<MihDedupDeps> = {},
): MihDedupDeps {
  return {
    supabaseAdmin: stub as unknown as MihDedupDeps['supabaseAdmin'],
    emitClusterCreated: vi.fn().mockResolvedValue(undefined),
    emitClusterMerged: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveMihDedup', () => {
  let stub: ReturnType<typeof createSupabaseStub>;

  beforeEach(() => {
    stub = createSupabaseStub();
  });

  // -------------------------------------------------------------------------
  // Test 1: new phone creates cluster + golden record with first_touch set
  // -------------------------------------------------------------------------
  describe('new phone (never seen)', () => {
    it('creates a new cluster with outcome=cluster_created', async () => {
      const raw = makeRawInbox();
      const deps = makeDeps(stub);

      const result = await resolveMihDedup(raw, deps);

      expect(result.outcome).toBe('cluster_created');
      expect(result.clusterId).toBeTruthy();
      expect(result.goldenRecordId).toBeTruthy();
    });

    it('creates an identity_node with the phone value', async () => {
      const raw = makeRawInbox({ phone_e164: '+919876543210' });
      await resolveMihDedup(raw, makeDeps(stub));

      const nodes = stub.stores.get('identity_nodes') ?? [];
      expect(nodes.length).toBe(1);
      expect(nodes[0].attribute_type).toBe('phone');
      expect(nodes[0].attribute_value).toBe('+919876543210');
    });

    it('sets golden_record.first_touch_at to source_received_at', async () => {
      const raw = makeRawInbox({ source_received_at: '2026-01-15T08:00:00Z' });
      await resolveMihDedup(raw, makeDeps(stub));

      const goldens = stub.stores.get('golden_records') ?? [];
      expect(goldens.length).toBe(1);
      expect(goldens[0].first_touch_at).toBe('2026-01-15T08:00:00Z');
      expect(goldens[0].last_touch_at).toBe('2026-01-15T08:00:00Z');
      expect(goldens[0].first_touch_raw_lead_id).toBe(raw.id);
    });

    it('emits cluster_created event', async () => {
      const emitClusterCreated = vi.fn().mockResolvedValue(undefined);
      const raw = makeRawInbox();
      await resolveMihDedup(raw, makeDeps(stub, { emitClusterCreated }));

      expect(emitClusterCreated).toHaveBeenCalledOnce();
    });

    it('two different phones create two separate clusters', async () => {
      const raw1 = makeRawInbox({ id: 'inbox-1', phone_e164: '+919000000001' });
      const raw2 = makeRawInbox({ id: 'inbox-2', phone_e164: '+919000000002' });

      const r1 = await resolveMihDedup(raw1, makeDeps(stub));
      const r2 = await resolveMihDedup(raw2, makeDeps(stub));

      expect(r1.clusterId).not.toBe(r2.clusterId);
      expect(r1.goldenRecordId).not.toBe(r2.goldenRecordId);

      const clusters = stub.stores.get('identity_clusters') ?? [];
      expect(clusters.length).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // Test 2: same phone within window merges to existing cluster, updates last_touch
  // -------------------------------------------------------------------------
  describe('same phone within dedup window', () => {
    // Use a fixed base time so observed_at and window cutoff are consistent
    const BASE_NOW = new Date('2026-01-10T12:00:00Z');

    it('merges into existing cluster (outcome=cluster_merged)', async () => {
      const raw1 = makeRawInbox({ id: 'inbox-1', source_received_at: '2026-01-01T08:00:00Z' });
      // First: create cluster (now = BASE_NOW so observed_at is within 60-day window)
      await resolveMihDedup(raw1, makeDeps(stub, { now: () => BASE_NOW }));

      // Second: same phone, within 60-day window
      const raw2 = makeRawInbox({ id: 'inbox-2', source_received_at: '2026-01-10T12:00:00Z' });
      const result = await resolveMihDedup(raw2, makeDeps(stub, { now: () => BASE_NOW }));

      expect(result.outcome).toBe('cluster_merged');
    });

    it('does NOT create a new cluster on merge', async () => {
      const raw1 = makeRawInbox({ id: 'inbox-a' });
      await resolveMihDedup(raw1, makeDeps(stub, { now: () => BASE_NOW }));

      const raw2 = makeRawInbox({ id: 'inbox-b' });
      await resolveMihDedup(raw2, makeDeps(stub, { now: () => BASE_NOW }));

      const clusters = stub.stores.get('identity_clusters') ?? [];
      expect(clusters.length).toBe(1);
    });

    it('updates last_touch but NOT first_touch when new lead is later', async () => {
      const raw1 = makeRawInbox({ id: 'inbox-early', source_received_at: '2026-01-01T08:00:00Z' });
      await resolveMihDedup(raw1, makeDeps(stub, { now: () => BASE_NOW }));

      const raw2 = makeRawInbox({ id: 'inbox-late', source_received_at: '2026-01-10T12:00:00Z' });
      await resolveMihDedup(raw2, makeDeps(stub, { now: () => BASE_NOW }));

      const goldens = stub.stores.get('golden_records') ?? [];
      expect(goldens.length).toBe(1);
      // first_touch should still be the early date
      expect(goldens[0].first_touch_at).toBe('2026-01-01T08:00:00Z');
      // last_touch updated to later date
      expect(goldens[0].last_touch_at).toBe('2026-01-10T12:00:00Z');
    });

    it('emits cluster_merged event', async () => {
      const emitClusterMerged = vi.fn().mockResolvedValue(undefined);
      const raw1 = makeRawInbox({ id: 'inbox-1' });
      await resolveMihDedup(raw1, makeDeps(stub, { now: () => BASE_NOW }));

      const raw2 = makeRawInbox({ id: 'inbox-2' });
      await resolveMihDedup(raw2, makeDeps(stub, { now: () => BASE_NOW, emitClusterMerged }));

      expect(emitClusterMerged).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Test 3: same phone outside window creates new cluster
  // -------------------------------------------------------------------------
  describe('same phone outside dedup window', () => {
    it('creates a new cluster when outside the window', async () => {
      // Seed dedup_rules_config with 1-day window
      stub.stores.set('dedup_rules_config', [{
        org_id: 'org-test',
        dedup_window_days: 1,
        fuzzy_name_threshold: 0.85,
        fuzzy_enabled: true,
        household_clustering_enabled: true,
        household_window_days: 30,
        manual_review_threshold: 0.70,
      }]);

      const raw1 = makeRawInbox({
        id: 'inbox-old',
        source_received_at: '2026-01-01T08:00:00Z',
      });
      // Create cluster at t=0
      await resolveMihDedup(raw1, makeDeps(stub, { now: () => new Date('2026-01-01T09:00:00Z') }));

      // New lead arrives at t+3 days (outside 1-day window)
      const raw2 = makeRawInbox({
        id: 'inbox-new',
        source_received_at: '2026-01-04T08:00:00Z',
      });
      const result = await resolveMihDedup(raw2, makeDeps(stub, { now: () => new Date('2026-01-04T09:00:00Z') }));

      expect(result.outcome).toBe('cluster_created');
      const clusters = stub.stores.get('identity_clusters') ?? [];
      expect(clusters.length).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // Test 4: golden_record.first_touch_at is always the earliest source_received_at
  // -------------------------------------------------------------------------
  describe('first_touch integrity', () => {
    it('first_touch_at is always the earliest source_received_at', async () => {
      // Both leads use the same NOW so they are within the dedup window
      const FIXED_NOW = new Date('2026-01-10T12:00:00Z');

      // Lead 1: source_received_at is later (2026-01-10)
      const raw1 = makeRawInbox({ id: 'inbox-later', source_received_at: '2026-01-10T10:00:00Z' });
      await resolveMihDedup(raw1, makeDeps(stub, { now: () => FIXED_NOW }));

      // Lead 2: same phone, but source_received_at is earlier (2026-01-05)
      // The dedup window is 60 days; FIXED_NOW - 60 days = ~Nov 11, both within window
      const raw2 = makeRawInbox({ id: 'inbox-earlier', source_received_at: '2026-01-05T08:00:00Z' });
      await resolveMihDedup(raw2, makeDeps(stub, { now: () => FIXED_NOW }));

      const goldens = stub.stores.get('golden_records') ?? [];
      expect(goldens.length).toBe(1);
      // first_touch_at should be the EARLIER date
      expect(goldens[0].first_touch_at).toBe('2026-01-05T08:00:00Z');
    });

    it('last_touch_at is always the latest source_received_at', async () => {
      const FIXED_NOW = new Date('2026-01-15T09:00:00Z');

      const raw1 = makeRawInbox({ id: 'inbox-a', source_received_at: '2026-01-01T08:00:00Z' });
      await resolveMihDedup(raw1, makeDeps(stub, { now: () => FIXED_NOW }));

      const raw2 = makeRawInbox({ id: 'inbox-b', source_received_at: '2026-01-15T08:00:00Z' });
      await resolveMihDedup(raw2, makeDeps(stub, { now: () => FIXED_NOW }));

      const goldens = stub.stores.get('golden_records') ?? [];
      expect(goldens[0].last_touch_at).toBe('2026-01-15T08:00:00Z');
    });
  });
});
