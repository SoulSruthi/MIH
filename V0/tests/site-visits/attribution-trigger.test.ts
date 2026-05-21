/**
 * Tests that the site visit consumer calls triggerAttribution
 * at the right moments (Spec 05 + Spec 04 wiring).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { consumeSiteVisitEvent } from '../../src/modules/site-visits/consumer.js';
import type { SiteVisitConsumerDeps } from '../../src/modules/site-visits/consumer.js';
import type { CrmSiteVisitPayload } from '../../src/modules/site-visits/types.js';

// ---------------------------------------------------------------------------
// Minimal in-memory stub
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;

function createStub() {
  const stores = new Map<string, MockRow[]>();
  const getStore = (t: string) => { if (!stores.has(t)) stores.set(t, []); return stores.get(t)!; };

  const buildChain = (table: string) => {
    let _filters: Array<{ f: string; v: unknown }> = [];
    let _insert: MockRow | null = null;
    let _singleMode = false;

    const self = {
      select: () => self,
      insert: (d: MockRow) => { _insert = d; return self; },
      eq: (f: string, v: unknown) => { _filters.push({ f, v }); return self; },
      limit: () => self,
      is: () => self,
      single: () => { _singleMode = true; return self; },
      then: (resolve: (v: { data: unknown; error: null }) => void) => {
        const store = getStore(table);
        if (_insert) {
          const row = { id: crypto.randomUUID(), ..._insert };
          store.push(row);
          return resolve({ data: _singleMode ? row : [row], error: null });
        }
        let rows = [...store];
        for (const { f, v } of _filters) rows = rows.filter((r) => r[f] === v);
        return resolve({ data: _singleMode ? (rows[0] ?? null) : rows, error: null });
      },
    };
    return self;
  };

  const schemaProxy = { from: (t: string) => buildChain(t) };
  return { schema: (_s: string) => schemaProxy, stores };
}

function makeDeps(stub: ReturnType<typeof createStub>, overrides: Partial<SiteVisitConsumerDeps> = {}): SiteVisitConsumerDeps {
  return {
    supabaseAdmin: stub as any,
    orgId: 'org-1',
    emitSiteVisitRecorded: vi.fn().mockResolvedValue(undefined),
    emitUnmatchedWalkIn: vi.fn().mockResolvedValue(undefined),
    triggerAttribution: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makePayload(overrides: Partial<CrmSiteVisitPayload> = {}): CrmSiteVisitPayload {
  return {
    crm_event_id: 'crm-ev-1',
    event_kind: 'completed',
    cluster_id: 'cluster-1',
    project_id: 'proj-1',
    completed_at: '2026-05-01T14:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('consumeSiteVisitEvent — attribution trigger wiring', () => {
  let stub: ReturnType<typeof createStub>;

  beforeEach(() => {
    stub = createStub();
  });

  it('calls triggerAttribution on site_visit_completed with cluster_id', async () => {
    const triggerAttribution = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps(stub, { triggerAttribution });

    await consumeSiteVisitEvent(makePayload({ event_kind: 'completed', cluster_id: 'cluster-1' }), deps);

    expect(triggerAttribution).toHaveBeenCalledOnce();
    const call = triggerAttribution.mock.calls[0][0];
    expect(call.clusterId).toBe('cluster-1');
    expect(call.eventCode).toBe('site_visit_completed');
    expect(call.projectId).toBe('proj-1');
    expect(call.conversionEventId).toBeTruthy();
  });

  it('does NOT call triggerAttribution on site_visit_scheduled', async () => {
    const triggerAttribution = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps(stub, { triggerAttribution });

    await consumeSiteVisitEvent(
      makePayload({ event_kind: 'scheduled', cluster_id: 'cluster-1', scheduled_at: '2026-05-02T10:00:00Z' }),
      deps,
    );

    expect(triggerAttribution).not.toHaveBeenCalled();
  });

  it('does NOT call triggerAttribution on no_show', async () => {
    const triggerAttribution = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps(stub, { triggerAttribution });

    await consumeSiteVisitEvent(makePayload({ event_kind: 'no_show', cluster_id: 'cluster-1' }), deps);

    expect(triggerAttribution).not.toHaveBeenCalled();
  });

  it('does NOT call triggerAttribution when cluster_id is missing on completed', async () => {
    const triggerAttribution = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps(stub, { triggerAttribution });

    await consumeSiteVisitEvent(
      makePayload({ event_kind: 'completed', cluster_id: undefined }),
      deps,
    );

    expect(triggerAttribution).not.toHaveBeenCalled();
  });

  it('works without triggerAttribution dep (backward compat)', async () => {
    const deps = makeDeps(stub, { triggerAttribution: undefined });

    const result = await consumeSiteVisitEvent(
      makePayload({ event_kind: 'completed', cluster_id: 'cluster-1' }),
      deps,
    );

    expect(result.outcome).toBe('recorded');
  });
});
