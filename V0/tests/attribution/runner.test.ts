/**
 * Tests for mih-attribution runner (Spec 04 — DB-aware layer)
 * All Supabase calls are mocked with an in-memory stub.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAttributionForConversionEvent } from '../../src/modules/mih-attribution/runner.js';
import type { AttributionRunArgs } from '../../src/modules/mih-attribution/runner.js';

// ---------------------------------------------------------------------------
// Minimal in-memory Supabase stub (reuses the pattern from dedup tests)
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
    let _inField: string | null = null;
    let _inValues: unknown[] = [];
    let _notField: string | null = null;
    let _notOp: string | null = null;
    let _limit: number | null = null;
    let _insertData: MockRow | MockRow[] | null = null;
    let _updateData: MockRow | null = null;
    let _upsertData: MockRow | null = null;
    let _upsertConflict: string | null = null;
    let _singleMode = false;
    let _selectFields = '*';

    const self = {
      select: (f = '*') => { _selectFields = f; return self; },
      insert: (d: MockRow | MockRow[]) => { _insertData = d; return self; },
      update: (d: MockRow) => { _updateData = d; return self; },
      upsert: (d: MockRow, opts?: { onConflict?: string }) => {
        _upsertData = d; _upsertConflict = opts?.onConflict ?? null; return self;
      },
      eq: (f: string, v: unknown) => { _filters.push({ field: f, op: 'eq', value: v }); return self; },
      is: (f: string, v: unknown) => { _filters.push({ field: f, op: 'is', value: v }); return self; },
      neq: (f: string, v: unknown) => { _filters.push({ field: f, op: 'neq', value: v }); return self; },
      in: (f: string, vs: unknown[]) => { _inField = f; _inValues = vs; return self; },
      not: (f: string, op: string, _v: unknown) => { _notField = f; _notOp = op; return self; },
      limit: (n: number) => { _limit = n; return self; },
      single: () => { _singleMode = true; return self; },
      then: (resolve: (v: { data: unknown; error: null | { message: string } }) => void) => {
        const store = getStore(table);

        if (_insertData !== null) {
          const rows = Array.isArray(_insertData) ? _insertData : [_insertData];
          const inserted: MockRow[] = [];
          for (const row of rows) {
            const newRow = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row };
            store.push(newRow);
            inserted.push(newRow);
          }
          const result = _singleMode ? (inserted[0] ?? null) : inserted;
          return resolve({ data: result, error: null });
        }

        if (_upsertData !== null) {
          const newRow = { id: crypto.randomUUID(), ...(_upsertData as MockRow) };
          store.push(newRow);
          return resolve({ data: newRow, error: null });
        }

        if (_updateData !== null) {
          const updated: MockRow[] = [];
          for (const row of store) {
            const match = _filters.every(({ field, op, value }) => {
              if (op === 'eq') return row[field] === value;
              if (op === 'is') return value === null ? row[field] == null : row[field] === value;
              return true;
            });
            if (match) { Object.assign(row, _updateData); updated.push(row); }
          }
          const result = _singleMode ? (updated[0] ?? null) : updated;
          return resolve({ data: result, error: null });
        }

        // SELECT
        let rows = [...store];
        for (const { field, op, value } of _filters) {
          rows = rows.filter((r) => {
            if (op === 'eq') return r[field] === value;
            if (op === 'is') return value === null ? r[field] == null : r[field] === value;
            if (op === 'neq') return r[field] !== value;
            return true;
          });
        }
        if (_inField) rows = rows.filter((r) => _inValues.includes(r[_inField!]));
        if (_notField && _notOp === 'is') rows = rows.filter((r) => r[_notField!] != null);
        if (_limit !== null) rows = rows.slice(0, _limit);
        const result = _singleMode ? (rows[0] ?? null) : rows;
        return resolve({ data: result, error: null });
      },
    };
    return self;
  };

  const schemaProxy = { from: (t: string) => buildChain(t) };
  return { schema: (_s: string) => schemaProxy, stores };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeArgs(overrides: Partial<AttributionRunArgs> = {}): AttributionRunArgs {
  return {
    conversionEventId: 'conv-1',
    clusterId: 'cluster-1',
    orgId: 'org-1',
    conversionOccurredAt: '2026-05-01T12:00:00Z',
    projectId: null,
    eventCode: 'site_visit_completed',
    dealValuePaise: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runAttributionForConversionEvent', () => {
  let stub: ReturnType<typeof createSupabaseStub>;

  beforeEach(() => {
    stub = createSupabaseStub();
  });

  it('creates a first_touch_v1 attribution_model when none exists', async () => {
    await runAttributionForConversionEvent(makeArgs(), stub as any);
    const models = stub.stores.get('attribution_models') ?? [];
    expect(models.length).toBe(1);
    expect(models[0].model_code).toBe('first_touch_v1');
    expect(models[0].is_operational).toBe(true);
  });

  it('reuses an existing operational model without creating a new one', async () => {
    stub.stores.set('attribution_models', [{
      id: 'model-existing',
      org_id: 'org-1',
      model_code: 'first_touch_v1',
      is_operational: true,
    }]);

    await runAttributionForConversionEvent(makeArgs(), stub as any);
    const models = stub.stores.get('attribution_models') ?? [];
    expect(models.length).toBe(1);
  });

  it('writes an attribution_result row', async () => {
    await runAttributionForConversionEvent(makeArgs(), stub as any);
    const results = stub.stores.get('attribution_results') ?? [];
    expect(results.length).toBe(1);
    expect(results[0].conversion_event_id).toBe('conv-1');
    expect(results[0].cluster_id).toBe('cluster-1');
    expect(results[0].org_id).toBe('org-1');
  });

  it('result reason is no_touchpoints_in_window when cluster has no edges', async () => {
    await runAttributionForConversionEvent(makeArgs(), stub as any);
    const results = stub.stores.get('attribution_results') ?? [];
    expect(results[0].reason).toBe('no_touchpoints_in_window');
    expect(results[0].winning_source_id).toBeNull();
  });

  it('resolves touchpoints via edges → nodes → raw_inbox and picks first touch', async () => {
    const nodeId = 'node-1';
    const rawLeadId = 'raw-1';
    const sourceId = 'src-1';

    stub.stores.set('identity_edges', [
      { id: 'edge-1', org_id: 'org-1', cluster_id: 'cluster-1', node_id: nodeId, reversed_at: null },
    ]);
    stub.stores.set('identity_nodes', [
      { id: nodeId, org_id: 'org-1', raw_lead_id: rawLeadId },
    ]);
    stub.stores.set('raw_inbox', [
      { id: rawLeadId, org_id: 'org-1', source_id: sourceId, source_received_at: '2026-04-01T10:00:00Z' },
    ]);
    stub.stores.set('sources', [
      { id: sourceId, taxonomy_path: 'online.meta.lead_ads' },
    ]);

    await runAttributionForConversionEvent(makeArgs(), stub as any);
    const results = stub.stores.get('attribution_results') ?? [];
    expect(results[0].winning_source_id).toBe(sourceId);
    expect(results[0].winning_raw_lead_id).toBe(rawLeadId);
    expect(results[0].reason).toBe('first_touch');
  });

  it('supersedes a prior attribution_result for the same conversion event', async () => {
    // Insert prior result
    stub.stores.set('attribution_models', [{
      id: 'model-1', org_id: 'org-1', model_code: 'first_touch_v1', is_operational: true,
    }]);
    stub.stores.set('attribution_results', [{
      id: 'result-old',
      org_id: 'org-1',
      conversion_event_id: 'conv-1',
      model_id: 'model-1',
      superseded_by_id: null,
    }]);

    await runAttributionForConversionEvent(makeArgs(), stub as any);

    const results = stub.stores.get('attribution_results') ?? [];
    // Old result should be superseded
    const old = results.find((r) => r.id === 'result-old');
    expect(old?.superseded_by_id).toBeTruthy();
    // New result should exist with null superseded_by_id
    const newResult = results.find((r) => r.id !== 'result-old');
    expect(newResult?.conversion_event_id).toBe('conv-1');
  });

  it('writes a dispute when CP claim block fires', async () => {
    const nodeOnlineId = 'node-online';
    const nodeCpId = 'node-cp';
    const rawOnlineId = 'raw-online';
    const rawCpId = 'raw-cp';
    const srcOnlineId = 'src-online';
    const srcCpId = 'src-cp';

    stub.stores.set('identity_edges', [
      { id: 'e1', org_id: 'org-1', cluster_id: 'cluster-1', node_id: nodeOnlineId, reversed_at: null },
      { id: 'e2', org_id: 'org-1', cluster_id: 'cluster-1', node_id: nodeCpId, reversed_at: null },
    ]);
    stub.stores.set('identity_nodes', [
      { id: nodeOnlineId, org_id: 'org-1', raw_lead_id: rawOnlineId },
      { id: nodeCpId, org_id: 'org-1', raw_lead_id: rawCpId },
    ]);
    // CP arrives FIRST — block fires because non-CP also exists in window
    stub.stores.set('raw_inbox', [
      { id: rawCpId, org_id: 'org-1', source_id: srcCpId, source_received_at: '2026-04-01T08:00:00Z' },
      { id: rawOnlineId, org_id: 'org-1', source_id: srcOnlineId, source_received_at: '2026-04-01T10:00:00Z' },
    ]);
    stub.stores.set('sources', [
      { id: srcOnlineId, taxonomy_path: 'online.meta' },
      { id: srcCpId, taxonomy_path: 'cp.broker.firm' },
    ]);

    await runAttributionForConversionEvent(makeArgs(), stub as any);

    const disputes = stub.stores.get('disputed_attributions') ?? [];
    expect(disputes.length).toBe(1);
    expect(disputes[0].dispute_reason).toBe('cp_claim_blocked');
    expect(disputes[0].state).toBe('open');
  });

  it('writes project_source_history when projectId is set and a winning source exists', async () => {
    const nodeId = 'node-p';
    const rawId = 'raw-p';
    const srcId = 'src-p';

    stub.stores.set('identity_edges', [
      { id: 'ep', org_id: 'org-1', cluster_id: 'cluster-1', node_id: nodeId, reversed_at: null },
    ]);
    stub.stores.set('identity_nodes', [{ id: nodeId, org_id: 'org-1', raw_lead_id: rawId }]);
    stub.stores.set('raw_inbox', [
      { id: rawId, org_id: 'org-1', source_id: srcId, source_received_at: '2026-04-01T10:00:00Z' },
    ]);
    stub.stores.set('sources', [{ id: srcId, taxonomy_path: 'online.portals.99acres' }]);

    await runAttributionForConversionEvent(
      makeArgs({ projectId: 'proj-1', dealValuePaise: 5_000_000 }),
      stub as any,
    );

    const history = stub.stores.get('project_source_history') ?? [];
    expect(history.length).toBe(1);
    expect(history[0].project_id).toBe('proj-1');
    expect(history[0].source_id).toBe(srcId);
    expect(history[0].bookings_count).toBe(1);
    expect(history[0].bookings_value).toBe(5_000_000);
  });

  it('increments project_source_history on subsequent attributions for same project+source', async () => {
    const srcId = 'src-q';
    const fyYear = 2026;

    // Seed existing history row
    stub.stores.set('project_source_history', [{
      id: 'psh-1',
      org_id: 'org-1',
      project_id: 'proj-1',
      source_id: srcId,
      fy_year: fyYear,
      event_code: 'site_visit_completed',
      bookings_count: 3,
      bookings_value: 15_000_000,
      leads_count: 5,
    }]);

    stub.stores.set('identity_edges', [
      { id: 'eq1', org_id: 'org-1', cluster_id: 'cluster-1', node_id: 'node-q', reversed_at: null },
    ]);
    stub.stores.set('identity_nodes', [{ id: 'node-q', org_id: 'org-1', raw_lead_id: 'raw-q' }]);
    stub.stores.set('raw_inbox', [
      { id: 'raw-q', org_id: 'org-1', source_id: srcId, source_received_at: '2026-05-01T08:00:00Z' },
    ]);
    stub.stores.set('sources', [{ id: srcId, taxonomy_path: 'online.google' }]);

    await runAttributionForConversionEvent(
      makeArgs({ projectId: 'proj-1', dealValuePaise: 5_000_000 }),
      stub as any,
    );

    const history = stub.stores.get('project_source_history') ?? [];
    const row = history.find((r) => r.id === 'psh-1');
    expect(row?.bookings_count).toBe(4);
    expect(row?.bookings_value).toBe(20_000_000);
  });

  it('uses default config when no attribution_config row exists for org', async () => {
    // No config in store — should not throw
    await expect(
      runAttributionForConversionEvent(makeArgs(), stub as any),
    ).resolves.not.toThrow();
  });
});
