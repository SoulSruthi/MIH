/**
 * Tests for reconciliation/actions.ts — executeResolutionActions()
 *
 * The function calls getSupabaseAdmin() internally so we mock
 * the module with vi.mock and inject our in-memory stub.
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
    let _limit: number | null = null;
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
      gt: (_f: string, _v: unknown) => self,
      limit: (n: number) => { _limit = n; return self; },
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
// Mock getSupabaseAdmin — must be declared before any imports that use it
// ---------------------------------------------------------------------------
let _stubInstance: ReturnType<typeof createSupabaseStub>;

vi.mock('../../src/lib/supabase-admin.js', () => ({
  getSupabaseAdmin: () => _stubInstance,
}));

// Import AFTER mock registration
const { executeResolutionActions } = await import('../../src/modules/reconciliation/actions.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
import type { ReconciliationItem } from '../../src/modules/reconciliation/types.js';

function makeItem(overrides: Partial<ReconciliationItem> = {}): ReconciliationItem {
  return {
    id: 'item-001',
    org_id: 'org-test',
    item_type: 'disputed_cp_credit',
    state: 'open',
    severity: 'normal',
    monetary_impact: 100_000,
    cluster_id: 'cluster-1',
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

describe('executeResolutionActions', () => {
  beforeEach(() => {
    _stubInstance = createSupabaseStub();
  });

  // -------------------------------------------------------------------------
  // disputed_cp_credit + override_attribution
  // Should: update attribution_results + insert into cp_commission_accruals
  // -------------------------------------------------------------------------
  it('disputed_cp_credit + override_attribution creates attribution result and CP accrual', async () => {
    // Pre-seed attribution_models so the override branch finds a model
    _stubInstance.stores.set('attribution_models', [{
      id: 'model-ft',
      org_id: 'org-test',
      model_code: 'first_touch_v1',
      is_operational: true,
    }]);

    const item = makeItem({
      item_type: 'disputed_cp_credit',
      context: {
        cp_id: 'cp-999',
        cp_source_id: 'src-cp',
        conversion_event_id: 'conv-123',
        booking_value: 5_000_000,
      },
    });

    const result = await executeResolutionActions(item, 'override_attribution', 'actor-1', {
      commission_pct: 0.03,
    });

    expect(result.errors).toHaveLength(0);
    // Attribution result should be inserted
    const attrResults = _stubInstance.stores.get('attribution_results') ?? [];
    expect(attrResults.length).toBeGreaterThanOrEqual(1);
    expect(attrResults[0]!.reason).toBe('manual_override');

    // CP accrual should be inserted
    const accruals = _stubInstance.stores.get('cp_commission_accruals') ?? [];
    expect(accruals).toHaveLength(1);
    expect(accruals[0]!.commission_pct).toBe(0.03);
    expect(result.actions_taken.some(a => a.includes('CP commission accrual created'))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // disputed_cp_credit + confirm_cp_credit
  // Should: ONLY create CP accrual, no attribution override
  // -------------------------------------------------------------------------
  it('disputed_cp_credit + confirm_cp_credit creates only CP accrual (no attribution change)', async () => {
    const item = makeItem({
      item_type: 'disputed_cp_credit',
      context: {
        cp_id: 'cp-888',
        conversion_event_id: 'conv-456',
        booking_value: 3_000_000,
      },
    });

    const result = await executeResolutionActions(item, 'confirm_cp_credit', 'actor-2');

    expect(result.errors).toHaveLength(0);
    // No attribution_results should be created (no model, no override path)
    const attrResults = _stubInstance.stores.get('attribution_results') ?? [];
    expect(attrResults).toHaveLength(0);

    // CP accrual should be created
    const accruals = _stubInstance.stores.get('cp_commission_accruals') ?? [];
    expect(accruals).toHaveLength(1);
    expect(accruals[0]!.cp_id).toBe('cp-888');
    expect(result.actions_taken.some(a => a.includes('CP commission accrual created'))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // unmatched_walk_in + accept_backfill
  // Should: insert into raw_leads with correct org_id, name, phone
  // -------------------------------------------------------------------------
  it('unmatched_walk_in inserts raw_lead with correct name, phone, source_id', async () => {
    const item = makeItem({
      item_type: 'unmatched_walk_in',
      context: {
        suggested_source_id: 'src-walkin',
        phone_e164: '+919876543210',
        name: 'Rajesh Kumar',
      },
    });

    const result = await executeResolutionActions(item, 'accept_backfill', 'actor-3');

    expect(result.errors).toHaveLength(0);
    const leads = _stubInstance.stores.get('raw_leads') ?? [];
    expect(leads).toHaveLength(1);
    expect(leads[0]!.org_id).toBe('org-test');
    expect(leads[0]!.name).toBe('Rajesh Kumar');
    expect(leads[0]!.phone_e164).toBe('+919876543210');
    expect(leads[0]!.source_id).toBe('src-walkin');
    expect(result.actions_taken.some(a => a.includes('backfilled'))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // manual_call_no_tracking + accept_manual_call
  // Should: insert attribution_result using the model from DB
  // -------------------------------------------------------------------------
  it('manual_call_no_tracking + accept_manual_call creates attribution_result', async () => {
    _stubInstance.stores.set('attribution_models', [{
      id: 'model-ft2',
      org_id: 'org-test',
      model_code: 'first_touch_v1',
      is_operational: true,
    }]);

    const item = makeItem({
      item_type: 'manual_call_no_tracking',
      context: {
        claimed_source_id: 'src-call',
        conversion_event_id: 'conv-789',
      },
    });

    const result = await executeResolutionActions(item, 'accept_manual_call', 'actor-4');

    expect(result.errors).toHaveLength(0);
    const attrResults = _stubInstance.stores.get('attribution_results') ?? [];
    expect(attrResults).toHaveLength(1);
    expect(attrResults[0]!.reason).toBe('manual_call_accepted');
    expect(attrResults[0]!.winning_source_id).toBe('src-call');
    expect(result.actions_taken.some(a => a.includes('manual call'))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // low_conf_identity_merge + any resolution
  // Should: log decision, no crash, actions_taken populated
  // -------------------------------------------------------------------------
  it('low_conf_identity_merge + approve_merge logs decision without crashing', async () => {
    const item = makeItem({
      item_type: 'low_conf_identity_merge',
      context: {
        cluster_id_1: 'cl-A',
        cluster_id_2: 'cl-B',
      },
    });

    const result = await executeResolutionActions(item, 'approve_merge', 'actor-5');

    expect(result.errors).toHaveLength(0);
    expect(result.actions_taken.some(a => a.includes('Merge approved'))).toBe(true);

    const audit = _stubInstance.stores.get('reconciliation_audit') ?? [];
    expect(audit).toHaveLength(1);
    expect(audit[0]!.action).toBe('resolution_set');
  });

  // -------------------------------------------------------------------------
  // low_conf_identity_merge + reject_merge
  // Should: record rejection, no audit insert, no crash
  // -------------------------------------------------------------------------
  it('low_conf_identity_merge + reject_merge records rejection without audit entry', async () => {
    const item = makeItem({
      item_type: 'low_conf_identity_merge',
      context: {
        cluster_id_1: 'cl-C',
        cluster_id_2: 'cl-D',
      },
    });

    const result = await executeResolutionActions(item, 'reject_merge', 'actor-6');

    expect(result.errors).toHaveLength(0);
    expect(result.actions_taken.some(a => a.includes('rejected'))).toBe(true);
    // No audit entry for rejection
    const audit = _stubInstance.stores.get('reconciliation_audit') ?? [];
    expect(audit).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Unknown item_type → returns manual resolution in actions_taken, no crash
  // -------------------------------------------------------------------------
  it('unknown item_type returns manual resolution action without crashing', async () => {
    const item = makeItem({
      item_type: 'source_disabled_violation' as any,
    });

    const result = await executeResolutionActions(item, 'some_resolution', 'actor-7');

    expect(result.errors).toHaveLength(0);
    expect(result.actions_taken).toHaveLength(1);
    expect(result.actions_taken[0]).toContain('Manual resolution recorded');
  });

  // -------------------------------------------------------------------------
  // Return shape — always returns { actions_taken: string[], errors: string[] }
  // -------------------------------------------------------------------------
  it('always returns { actions_taken, errors } shape even for no-op case', async () => {
    const item = makeItem({ item_type: 'disputed_cp_credit', context: {} });

    const result = await executeResolutionActions(item, 'override_attribution', 'actor-8');

    expect(result).toHaveProperty('actions_taken');
    expect(result).toHaveProperty('errors');
    expect(Array.isArray(result.actions_taken)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
