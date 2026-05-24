/**
 * Tests for reconciliation/resolver.ts — resolveItem()
 *
 * resolveItem() orchestrates:
 *  1. getItem() — fetch item from DB
 *  2. executeResolutionActions() — run downstream effects
 *  3. updateState() — mark item resolved + write audit entry
 *
 * All Supabase calls go through mocked getSupabaseAdmin().
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
    let _updateData: MockRow | null = null;

    const self = {
      select: (_fields = '*', _opts?: unknown) => self,
      insert: (data: MockRow | MockRow[]) => { _insertData = data; return self; },
      upsert: (data: MockRow | MockRow[], _opts?: unknown) => { _insertData = data; return self; },
      update: (data: MockRow) => { _updateData = data; return self; },
      delete: () => self,
      eq: (field: string, value: unknown) => { _filters.push({ field, op: 'eq', value }); return self; },
      not: (_f: string, _op: string, _v: unknown) => self,
      is: (_f: string, _v: unknown) => self,
      in: (_f: string, _v: unknown) => self,
      gte: (_f: string, _v: unknown) => self,
      gt: (_f: string, _v: unknown) => self,
      lt: (_f: string, _v: unknown) => self,
      limit: (_n: number) => self,
      order: () => self,
      maybeSingle: () => { _singleMode = true; return self; },
      single: () => { _singleMode = true; return self; },
      range: (_from: number, _to: number) => self,
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

        // SELECT
        let rows = [...store];
        for (const { field, value } of _filters) {
          rows = rows.filter(r => r[field] === value);
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
// Mock getSupabaseAdmin — actions.ts AND resolver.ts both call it
// ---------------------------------------------------------------------------
let _stubInstance: ReturnType<typeof createSupabaseStub>;

vi.mock('../../src/lib/supabase-admin.js', () => ({
  getSupabaseAdmin: () => _stubInstance,
}));

const { resolveItem } = await import('../../src/modules/reconciliation/resolver.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
import type { ReconciliationItem } from '../../src/modules/reconciliation/types.js';

function makeItem(overrides: Partial<ReconciliationItem> = {}): MockRow {
  return {
    id: 'item-res-001',
    org_id: 'org-res',
    item_type: 'manual_call_no_tracking',
    state: 'open',
    severity: 'normal',
    monetary_impact: 50_000,
    cluster_id: null,
    origin_event_id: null,
    sla_deadline_at: null,
    assigned_to: null,
    context: {},
    resolution: null,
    resolution_actions: null,
    resolved_by: null,
    resolved_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveItem', () => {
  beforeEach(() => {
    _stubInstance = createSupabaseStub();
  });

  // -------------------------------------------------------------------------
  // Happy path: updates item state to 'resolved', calls executeResolutionActions
  // -------------------------------------------------------------------------
  it('happy path: resolves item and updates state to resolved', async () => {
    const item = makeItem();
    _stubInstance.stores.set('reconciliation_items', [item]);

    const resolved = await resolveItem(
      'item-res-001',
      'org-res',
      'accept_manual_call',
      'actor-resolve',
    );

    expect(resolved.state).toBe('resolved');
    expect(resolved.resolution).toBe('accept_manual_call');
    expect(resolved.resolved_by).toBe('actor-resolve');
    expect(resolved.resolved_at).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Writes reconciliation_audit entry on state change
  // -------------------------------------------------------------------------
  it('writes a reconciliation_audit entry with state_change action', async () => {
    const item = makeItem();
    _stubInstance.stores.set('reconciliation_items', [item]);

    await resolveItem('item-res-001', 'org-res', 'close_as_invalid', 'actor-audit');

    const audit = _stubInstance.stores.get('reconciliation_audit') ?? [];
    // At least one audit entry with state_change
    const stateChange = audit.find(a => a.action === 'state_change');
    expect(stateChange).toBeDefined();
    const newVal = stateChange!.new_value as Record<string, unknown>;
    expect(newVal.state).toBe('resolved');
  });

  // -------------------------------------------------------------------------
  // Item not found: throws descriptive error
  // -------------------------------------------------------------------------
  it('throws error when item is not found', async () => {
    // Empty store — no items
    _stubInstance.stores.set('reconciliation_items', []);

    await expect(
      resolveItem('nonexistent-id', 'org-res', 'some_resolution', 'actor'),
    ).rejects.toThrow('Reconciliation item not found');
  });

  // -------------------------------------------------------------------------
  // Already resolved item: throws error (prevents double-resolution)
  // -------------------------------------------------------------------------
  it('throws error when item is already resolved', async () => {
    const item = makeItem({ state: 'resolved' });
    _stubInstance.stores.set('reconciliation_items', [item]);

    await expect(
      resolveItem('item-res-001', 'org-res', 'some_resolution', 'actor'),
    ).rejects.toThrow('already');
  });

  // -------------------------------------------------------------------------
  // Closed item: throws error
  // -------------------------------------------------------------------------
  it('throws error when item is already closed', async () => {
    const item = makeItem({ state: 'closed' });
    _stubInstance.stores.set('reconciliation_items', [item]);

    await expect(
      resolveItem('item-res-001', 'org-res', 'close_resolution', 'actor'),
    ).rejects.toThrow('already');
  });

  // -------------------------------------------------------------------------
  // executeResolutionActions errors captured in resolution_actions
  // The resolution should still complete even when downstream actions fail
  // -------------------------------------------------------------------------
  it('completes resolution even when executeResolutionActions has partial failures', async () => {
    // Item with disputed_cp_credit but NO cp_id in context → no accrual → actions still complete
    const item = makeItem({
      item_type: 'disputed_cp_credit',
      context: { cp_id: undefined, booking_value: undefined },
    });
    _stubInstance.stores.set('reconciliation_items', [item]);

    // Should not throw — actions failure is captured in resolution_actions.execution_errors
    const resolved = await resolveItem(
      'item-res-001',
      'org-res',
      'override_attribution',
      'actor-partial',
    );

    expect(resolved.state).toBe('resolved');
  });

  // -------------------------------------------------------------------------
  // resolution_actions object is persisted with actions_taken
  // -------------------------------------------------------------------------
  it('persists actions_taken in resolution_actions on the resolved item', async () => {
    // Manual resolution for unknown type → actions_taken = ['Manual resolution recorded: ...']
    const item = makeItem({ item_type: 'source_disabled_violation' as any });
    _stubInstance.stores.set('reconciliation_items', [item]);

    const resolved = await resolveItem(
      'item-res-001',
      'org-res',
      'manual_close',
      'actor-manual',
    );

    expect(resolved.resolution_actions).toBeTruthy();
    const ra = resolved.resolution_actions as Record<string, unknown>;
    expect(Array.isArray(ra.actions_taken)).toBe(true);
    expect((ra.actions_taken as string[]).some(a => a.includes('Manual resolution'))).toBe(true);
  });
});
