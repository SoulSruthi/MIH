/**
 * Unit tests for the conversion reversal logic.
 *
 * We exercise the core business logic by driving it through a Supabase stub
 * (same pattern as runner.test.ts) rather than testing the HTTP layer.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Minimal in-memory Supabase stub (mirrors runner.test.ts pattern)
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
    let _updateData: MockRow | null = null;
    let _singleMode = false;

    const self = {
      select: (_f = '*') => self,
      insert: (d: MockRow | MockRow[]) => { _insertData = d; return self; },
      update: (d: MockRow) => { _updateData = d; return self; },
      eq: (f: string, v: unknown) => { _filters.push({ field: f, op: 'eq', value: v }); return self; },
      is: (f: string, v: unknown) => { _filters.push({ field: f, op: 'is', value: v }); return self; },
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
            return true;
          });
        }
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
// Core reversal logic (extracted from the route handler for unit testing)
// ---------------------------------------------------------------------------
interface ReversalArgs {
  orgId: string;
  conversionEventId: string;
  reason: string;
}

interface ReversalResult {
  conversion_event_id: string;
  reversed_at: string;
  results_superseded: number;
}

class ConversionEventNotFoundError extends Error {
  constructor() { super('NOT_FOUND: Conversion event not found'); }
}

class AlreadyReversedError extends Error {
  constructor() { super('CONFLICT: Conversion event is already reversed'); }
}

async function applyConversionReversal(
  args: ReversalArgs,
  supabase: ReturnType<typeof createSupabaseStub>,
): Promise<ReversalResult> {
  const { orgId, conversionEventId, reason } = args;

  // 2. Verify the conversion_event exists, belongs to org, and is NOT already reversed
  const { data: conversionEvent } = await (supabase as any)
    .schema('mih')
    .from('conversion_events')
    .select('id, cluster_id, reversed_at')
    .eq('org_id', orgId)
    .eq('id', conversionEventId)
    .single();

  if (!conversionEvent) throw new ConversionEventNotFoundError();

  const ce = conversionEvent as Record<string, unknown>;

  if (ce.reversed_at !== null && ce.reversed_at !== undefined) {
    throw new AlreadyReversedError();
  }

  // 3. Set reversed_at and reversed_reason on the conversion_event
  const reversedAt = new Date().toISOString();

  await (supabase as any)
    .schema('mih')
    .from('conversion_events')
    .update({
      reversed_at: reversedAt,
      reversed_reason: reason,
    })
    .eq('org_id', orgId)
    .eq('id', conversionEventId);

  // 4. Find all non-superseded attribution_results for this conversion_event
  const { data: activeResults } = await (supabase as any)
    .schema('mih')
    .from('attribution_results')
    .select('id, model_id, org_id, cluster_id')
    .eq('org_id', orgId)
    .eq('conversion_event_id', conversionEventId)
    .is('superseded_by_id', null);

  const results = (activeResults ?? []) as Array<Record<string, unknown>>;

  // 5. For each active result: insert reversal tombstone, then mark original superseded
  let resultsSuperseded = 0;

  for (const result of results) {
    const { data: tombstone } = await (supabase as any)
      .schema('mih')
      .from('attribution_results')
      .insert({
        org_id: orgId,
        conversion_event_id: conversionEventId,
        model_id: result.model_id,
        cluster_id: result.cluster_id ?? null,
        winning_source_id: null,
        winning_raw_lead_id: null,
        winning_touch_at: null,
        weight: 0,
        reason: 'conversion_reversed',
        rule_applied: 'conversion_reversed',
        computation_inputs: {
          reversal_reason: reason,
          original_result_id: result.id,
        },
      })
      .select('id')
      .single();

    if (!tombstone) continue;

    const tombstoneId = (tombstone as Record<string, string>).id;

    await (supabase as any)
      .schema('mih')
      .from('attribution_results')
      .update({ superseded_by_id: tombstoneId })
      .eq('id', result.id as string);

    resultsSuperseded++;
  }

  return {
    conversion_event_id: conversionEventId,
    reversed_at: reversedAt,
    results_superseded: resultsSuperseded,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('conversion reversal', () => {
  let stub: ReturnType<typeof createSupabaseStub>;

  const BASE_ARGS: ReversalArgs = {
    orgId: 'org-1',
    conversionEventId: 'ce-1',
    reason: 'booking_cancelled',
  };

  beforeEach(() => {
    stub = createSupabaseStub();
    // Seed a conversion_event (not reversed)
    stub.stores.set('conversion_events', [
      { id: 'ce-1', org_id: 'org-1', cluster_id: 'cluster-1', reversed_at: null },
    ]);
  });

  it('sets reversed_at on the conversion_event', async () => {
    const result = await applyConversionReversal(BASE_ARGS, stub);

    const events = stub.stores.get('conversion_events') ?? [];
    const ce = events.find((e) => e.id === 'ce-1');
    expect(ce?.reversed_at).toBeTruthy();
    expect(typeof ce?.reversed_at).toBe('string');
    expect(result.reversed_at).toBeTruthy();
  });

  it('sets reversed_reason on the conversion_event', async () => {
    await applyConversionReversal(BASE_ARGS, stub);

    const events = stub.stores.get('conversion_events') ?? [];
    const ce = events.find((e) => e.id === 'ce-1');
    expect(ce?.reversed_reason).toBe('booking_cancelled');
  });

  it('supersedes existing attribution_results for the conversion_event', async () => {
    stub.stores.set('attribution_results', [
      {
        id: 'result-1',
        org_id: 'org-1',
        conversion_event_id: 'ce-1',
        model_id: 'model-1',
        cluster_id: 'cluster-1',
        superseded_by_id: null,
        reason: 'first_touch',
      },
      {
        id: 'result-2',
        org_id: 'org-1',
        conversion_event_id: 'ce-1',
        model_id: 'model-2',
        cluster_id: 'cluster-1',
        superseded_by_id: null,
        reason: 'last_touch',
      },
    ]);

    const result = await applyConversionReversal(BASE_ARGS, stub);

    expect(result.results_superseded).toBe(2);

    const allResults = stub.stores.get('attribution_results') ?? [];
    const original1 = allResults.find((r) => r.id === 'result-1');
    const original2 = allResults.find((r) => r.id === 'result-2');
    expect(original1?.superseded_by_id).toBeTruthy();
    expect(original2?.superseded_by_id).toBeTruthy();
  });

  it('creates tombstone attribution_result rows with reason=conversion_reversed', async () => {
    stub.stores.set('attribution_results', [
      {
        id: 'result-1',
        org_id: 'org-1',
        conversion_event_id: 'ce-1',
        model_id: 'model-1',
        cluster_id: 'cluster-1',
        superseded_by_id: null,
        reason: 'first_touch',
      },
    ]);

    await applyConversionReversal(BASE_ARGS, stub);

    const allResults = stub.stores.get('attribution_results') ?? [];
    const tombstones = allResults.filter((r) => r.reason === 'conversion_reversed');
    expect(tombstones.length).toBe(1);
    expect(tombstones[0].weight).toBe(0);
    expect(tombstones[0].winning_source_id).toBeNull();
  });

  it('returns results_superseded=0 when no active attribution_results exist', async () => {
    // No attribution results seeded
    const result = await applyConversionReversal(BASE_ARGS, stub);
    expect(result.results_superseded).toBe(0);
    expect(result.conversion_event_id).toBe('ce-1');
  });

  it('returns the conversion_event_id in the result', async () => {
    const result = await applyConversionReversal(BASE_ARGS, stub);
    expect(result.conversion_event_id).toBe('ce-1');
  });

  it('throws CONFLICT when event is already reversed', async () => {
    stub.stores.set('conversion_events', [
      {
        id: 'ce-1',
        org_id: 'org-1',
        cluster_id: 'cluster-1',
        reversed_at: '2026-05-01T00:00:00Z',
        reversed_reason: 'data_error',
      },
    ]);

    await expect(applyConversionReversal(BASE_ARGS, stub)).rejects.toThrow('CONFLICT');
  });

  it('throws NOT_FOUND when conversion_event does not exist', async () => {
    stub.stores.set('conversion_events', []); // empty store

    await expect(
      applyConversionReversal({ ...BASE_ARGS, conversionEventId: 'nonexistent' }, stub),
    ).rejects.toThrow('NOT_FOUND');
  });

  it('does not supersede already-superseded attribution_results', async () => {
    stub.stores.set('attribution_results', [
      {
        id: 'result-active',
        org_id: 'org-1',
        conversion_event_id: 'ce-1',
        model_id: 'model-1',
        cluster_id: 'cluster-1',
        superseded_by_id: null,
        reason: 'first_touch',
      },
      {
        id: 'result-already-superseded',
        org_id: 'org-1',
        conversion_event_id: 'ce-1',
        model_id: 'model-1',
        cluster_id: 'cluster-1',
        superseded_by_id: 'result-active', // already superseded
        reason: 'no_touchpoints_in_window',
      },
    ]);

    const result = await applyConversionReversal(BASE_ARGS, stub);
    // Only the active (non-superseded) result should be superseded
    expect(result.results_superseded).toBe(1);
  });
});
