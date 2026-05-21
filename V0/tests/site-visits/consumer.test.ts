/**
 * Tests for site-visits consumer and portal-sla (Spec 05 V0)
 * All Supabase calls are mocked with in-memory stubs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { consumeSiteVisitEvent } from '../../src/modules/site-visits/consumer.js';
import { computePortalSlaPacing } from '../../src/modules/site-visits/portal-sla.js';
import type { SiteVisitConsumerDeps } from '../../src/modules/site-visits/consumer.js';
import type { CrmSiteVisitPayload, PortalSlaTarget } from '../../src/modules/site-visits/types.js';

// ---------------------------------------------------------------------------
// In-memory Supabase stub (same pattern as dedup tests)
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
    let _insertData: MockRow | MockRow[] | null = null;
    let _selectFields = '*';
    let _singleMode = false;

    const self = {
      select: (fields = '*') => { _selectFields = fields; return self; },
      insert: (data: MockRow | MockRow[]) => { _insertData = data; return self; },
      eq: (field: string, value: unknown) => { _filters.push({ field, op: 'eq', value }); return self; },
      limit: (n: number) => { _limit = n; return self; },
      single: () => { _singleMode = true; return self; },
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

        // SELECT
        let rows = [...store];
        for (const { field, op, value } of _filters) {
          rows = rows.filter((r) => {
            if (op === 'eq') return r[field] === value;
            return true;
          });
        }
        if (_limit !== null) rows = rows.slice(0, _limit);
        const result = _singleMode ? rows[0] ?? null : rows;
        return resolve({ data: result, error: null });
      },
    };
    Object.assign(chain, self);
    return chain;
  };

  const schemaProxy = { from: (table: string) => buildChain(table) };
  return { schema: (_name: string) => schemaProxy, stores };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePayload(overrides: Partial<CrmSiteVisitPayload> = {}): CrmSiteVisitPayload {
  return {
    crm_event_id: `crm-${Math.random().toString(36).slice(2)}`,
    event_kind: 'scheduled',
    cluster_id: 'cluster-001',
    project_id: 'proj-001',
    source_id: 'src-portal',
    scheduled_at: '2026-06-01T10:00:00Z',
    ...overrides,
  };
}

function makeDeps(
  stub: ReturnType<typeof createSupabaseStub>,
  overrides: Partial<SiteVisitConsumerDeps> = {},
): SiteVisitConsumerDeps {
  return {
    supabaseAdmin: stub as unknown as SiteVisitConsumerDeps['supabaseAdmin'],
    orgId: 'org-test',
    emitSiteVisitRecorded: vi.fn().mockResolvedValue(undefined),
    emitUnmatchedWalkIn: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('consumeSiteVisitEvent', () => {
  let stub: ReturnType<typeof createSupabaseStub>;

  beforeEach(() => {
    stub = createSupabaseStub();
  });

  // -------------------------------------------------------------------------
  // Test 1: new scheduled event → recorded, creates site_visit_event + conversion_event
  // -------------------------------------------------------------------------
  describe('new scheduled event', () => {
    it('returns outcome=recorded', async () => {
      const payload = makePayload({ event_kind: 'scheduled' });
      const result = await consumeSiteVisitEvent(payload, makeDeps(stub));

      expect(result.outcome).toBe('recorded');
    });

    it('inserts a row into site_visit_events', async () => {
      const payload = makePayload({ event_kind: 'scheduled' });
      await consumeSiteVisitEvent(payload, makeDeps(stub));

      const rows = stub.stores.get('site_visit_events') ?? [];
      expect(rows.length).toBe(1);
      expect(rows[0].crm_event_id).toBe(payload.crm_event_id);
      expect(rows[0].event_kind).toBe('scheduled');
    });

    it('inserts a conversion_event with event_code=site_visit_scheduled', async () => {
      const payload = makePayload({ event_kind: 'scheduled' });
      const result = await consumeSiteVisitEvent(payload, makeDeps(stub));

      expect((result as { outcome: 'recorded'; conversionEventId: string | null }).conversionEventId).toBeTruthy();

      const convRows = stub.stores.get('conversion_events') ?? [];
      expect(convRows.length).toBe(1);
      expect(convRows[0].event_code).toBe('site_visit_scheduled');
    });

    it('emits site_visit_recorded event', async () => {
      const emitSiteVisitRecorded = vi.fn().mockResolvedValue(undefined);
      await consumeSiteVisitEvent(makePayload(), makeDeps(stub, { emitSiteVisitRecorded }));

      expect(emitSiteVisitRecorded).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Test 2: duplicate crm_event_id → returns 'duplicate', no new rows
  // -------------------------------------------------------------------------
  describe('duplicate crm_event_id', () => {
    it('returns outcome=duplicate on second call with same crm_event_id', async () => {
      const payload = makePayload({ crm_event_id: 'crm-fixed-001' });
      await consumeSiteVisitEvent(payload, makeDeps(stub));

      const result = await consumeSiteVisitEvent(payload, makeDeps(stub));
      expect(result.outcome).toBe('duplicate');
    });

    it('does not insert additional rows on duplicate', async () => {
      const payload = makePayload({ crm_event_id: 'crm-fixed-002' });
      await consumeSiteVisitEvent(payload, makeDeps(stub));
      await consumeSiteVisitEvent(payload, makeDeps(stub));

      const rows = stub.stores.get('site_visit_events') ?? [];
      expect(rows.length).toBe(1);
    });

    it('returns the existing siteVisitEventId on duplicate', async () => {
      const payload = makePayload({ crm_event_id: 'crm-fixed-003' });
      const first = await consumeSiteVisitEvent(payload, makeDeps(stub));
      const second = await consumeSiteVisitEvent(payload, makeDeps(stub));

      expect(second.outcome).toBe('duplicate');
      if (first.outcome === 'recorded' && second.outcome === 'duplicate') {
        expect(second.siteVisitEventId).toBe(first.siteVisitEventId);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Test 3: walk_in with no cluster_id → returns 'unmatched_walk_in', emits event
  // -------------------------------------------------------------------------
  describe('walk_in_unscheduled with no cluster_id', () => {
    it('returns outcome=unmatched_walk_in', async () => {
      const payload = makePayload({ event_kind: 'walk_in_unscheduled', cluster_id: null });
      const result = await consumeSiteVisitEvent(payload, makeDeps(stub));

      expect(result.outcome).toBe('unmatched_walk_in');
    });

    it('inserts the walk_in row into site_visit_events with null cluster_id', async () => {
      const payload = makePayload({ event_kind: 'walk_in_unscheduled', cluster_id: null });
      await consumeSiteVisitEvent(payload, makeDeps(stub));

      const rows = stub.stores.get('site_visit_events') ?? [];
      expect(rows.length).toBe(1);
      expect(rows[0].cluster_id).toBeNull();
    });

    it('emits unmatched_walk_in event', async () => {
      const emitUnmatchedWalkIn = vi.fn().mockResolvedValue(undefined);
      const payload = makePayload({ event_kind: 'walk_in_unscheduled', cluster_id: null });
      await consumeSiteVisitEvent(payload, makeDeps(stub, { emitUnmatchedWalkIn }));

      expect(emitUnmatchedWalkIn).toHaveBeenCalledOnce();
    });

    it('does NOT create a conversion_event for walk_in_unscheduled', async () => {
      const payload = makePayload({ event_kind: 'walk_in_unscheduled', cluster_id: null });
      await consumeSiteVisitEvent(payload, makeDeps(stub));

      const convRows = stub.stores.get('conversion_events') ?? [];
      expect(convRows.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Test 4: completed event → creates conversion_event with event_code='site_visit_completed'
  // -------------------------------------------------------------------------
  describe('completed event', () => {
    it('returns outcome=recorded', async () => {
      const payload = makePayload({ event_kind: 'completed', completed_at: '2026-06-01T14:00:00Z' });
      const result = await consumeSiteVisitEvent(payload, makeDeps(stub));

      expect(result.outcome).toBe('recorded');
    });

    it('creates conversion_event with event_code=site_visit_completed', async () => {
      const payload = makePayload({ event_kind: 'completed', completed_at: '2026-06-01T14:00:00Z' });
      await consumeSiteVisitEvent(payload, makeDeps(stub));

      const convRows = stub.stores.get('conversion_events') ?? [];
      expect(convRows.length).toBe(1);
      expect(convRows[0].event_code).toBe('site_visit_completed');
    });

    it('uses completed_at as occurred_at in the conversion_event', async () => {
      const completedAt = '2026-06-01T14:00:00Z';
      const payload = makePayload({ event_kind: 'completed', completed_at: completedAt });
      await consumeSiteVisitEvent(payload, makeDeps(stub));

      const convRows = stub.stores.get('conversion_events') ?? [];
      expect(convRows[0].occurred_at).toBe(completedAt);
    });
  });

  // -------------------------------------------------------------------------
  // Test 5: non-conversion event kinds do NOT create a conversion_event
  // -------------------------------------------------------------------------
  describe('non-conversion event kinds', () => {
    it.each(['rescheduled', 'cab_dispatched', 'customer_en_route', 'no_show', 'cancelled'] as const)(
      '%s does not create a conversion_event',
      async (kind) => {
        const payload = makePayload({ event_kind: kind });
        const result = await consumeSiteVisitEvent(payload, makeDeps(stub));

        expect(result.outcome).toBe('recorded');
        if (result.outcome === 'recorded') {
          expect(result.conversionEventId).toBeNull();
        }
        const convRows = stub.stores.get('conversion_events') ?? [];
        expect(convRows.length).toBe(0);
      },
    );
  });
});

// ---------------------------------------------------------------------------
// Portal SLA pacing tests
// ---------------------------------------------------------------------------

describe('computePortalSlaPacing', () => {
  const TARGET_MONTH = '2026-06';

  function makeTarget(overrides: Partial<PortalSlaTarget> = {}): PortalSlaTarget {
    return {
      source_id: 'src-portal',
      project_id: null,
      target_month: TARGET_MONTH,
      target_count: 30,
      ...overrides,
    };
  }

  it('returns is_breached=false when pacing is exactly 1.0', () => {
    // Mid-month: day 15 of 30, expected = 15. Actual = 15 → pacing = 1.0
    const today = new Date('2026-06-15');
    const target = makeTarget({ target_count: 30 });
    const [status] = computePortalSlaPacing([target], { 'src-portal': 15 }, today);

    expect(status.pacing_pct).toBeCloseTo(1.0);
    expect(status.is_breached).toBe(false);
  });

  it('returns is_breached=true when pacing < 0.80', () => {
    // Day 20 of 30, expected = 20. Actual = 10 → pacing = 0.5 (< 0.80)
    const today = new Date('2026-06-20');
    const target = makeTarget({ target_count: 30 });
    const [status] = computePortalSlaPacing([target], { 'src-portal': 10 }, today);

    expect(status.pacing_pct).toBeCloseTo(0.5);
    expect(status.is_breached).toBe(true);
  });

  it('returns is_breached=false when pacing >= 0.80', () => {
    // Day 10 of 30, expected = 10. Actual = 9 → pacing = 0.9 (>= 0.80)
    const today = new Date('2026-06-10');
    const target = makeTarget({ target_count: 30 });
    const [status] = computePortalSlaPacing([target], { 'src-portal': 9 }, today);

    expect(status.pacing_pct).toBeCloseTo(0.9);
    expect(status.is_breached).toBe(false);
  });

  it('actual_count is 0 when source not in actualCounts', () => {
    const today = new Date('2026-06-15');
    const target = makeTarget();
    const [status] = computePortalSlaPacing([target], {}, today);

    expect(status.actual_count).toBe(0);
    expect(status.is_breached).toBe(true);
  });

  it('resolves counts by specific source_id:project_id key when project_id is set', () => {
    const today = new Date('2026-06-15');
    const target = makeTarget({ project_id: 'proj-001', target_count: 30 });
    // Provide count only under specific key — generic key should NOT be used
    const [status] = computePortalSlaPacing(
      [target],
      { 'src-portal:proj-001': 15 },
      today,
    );

    expect(status.actual_count).toBe(15);
    expect(status.pacing_pct).toBeCloseTo(1.0);
  });

  it('returns actual_count and target_count in status', () => {
    const today = new Date('2026-06-15');
    const target = makeTarget({ target_count: 40 });
    const [status] = computePortalSlaPacing([target], { 'src-portal': 20 }, today);

    expect(status.target_count).toBe(40);
    expect(status.actual_count).toBe(20);
  });

  it('handles multiple targets independently', () => {
    const today = new Date('2026-06-20');
    const targets: PortalSlaTarget[] = [
      { source_id: 'src-a', project_id: null, target_month: TARGET_MONTH, target_count: 30 },
      { source_id: 'src-b', project_id: null, target_month: TARGET_MONTH, target_count: 30 },
    ];
    // src-a: 20 actual, expected 20 → pacing 1.0 (ok)
    // src-b: 5 actual, expected 20 → pacing 0.25 (breached)
    const statuses = computePortalSlaPacing(targets, { 'src-a': 20, 'src-b': 5 }, today);

    expect(statuses[0].is_breached).toBe(false);
    expect(statuses[1].is_breached).toBe(true);
  });
});
