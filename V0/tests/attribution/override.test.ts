/**
 * Unit tests for the manual attribution override logic.
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
// Core override logic (extracted from the route handler for unit testing)
// ---------------------------------------------------------------------------
interface OverrideArgs {
  orgId: string;
  conversion_event_id: string;
  winning_source_id: string;
  winning_raw_lead_id?: string;
  override_reason: string;
  notes?: string;
}

interface OverrideResult {
  attribution_result: Record<string, unknown>;
  superseded_id: string | null;
}

async function applyManualOverride(
  args: OverrideArgs,
  supabase: ReturnType<typeof createSupabaseStub>,
): Promise<OverrideResult> {
  const {
    orgId,
    conversion_event_id,
    winning_source_id,
    winning_raw_lead_id,
    override_reason,
    notes,
  } = args;

  // Check manual_override_allowed
  const { data: configRow } = await (supabase as any)
    .schema('mih')
    .from('attribution_config')
    .select('manual_override_allowed')
    .eq('org_id', orgId)
    .single();

  const manualOverrideAllowed =
    configRow === null ? true : ((configRow as Record<string, unknown>).manual_override_allowed ?? true);

  if (!manualOverrideAllowed) {
    throw new Error('FORBIDDEN: Manual overrides are disabled for this organization');
  }

  // Get conversion_event
  const { data: conversionEvent } = await (supabase as any)
    .schema('mih')
    .from('conversion_events')
    .select('id, cluster_id')
    .eq('org_id', orgId)
    .eq('id', conversion_event_id)
    .single();

  if (!conversionEvent) throw new Error('NOT_FOUND: Conversion event not found');
  const ce = conversionEvent as Record<string, unknown>;

  // Get or create first_touch_v1 model
  const { data: modelRow } = await (supabase as any)
    .schema('mih')
    .from('attribution_models')
    .select('id')
    .eq('org_id', orgId)
    .eq('model_code', 'first_touch_v1')
    .eq('is_operational', true)
    .single();

  let modelId: string;
  if (modelRow) {
    modelId = (modelRow as Record<string, string>).id;
  } else {
    const { data: created } = await (supabase as any)
      .schema('mih')
      .from('attribution_models')
      .insert({
        org_id: orgId,
        model_code: 'first_touch_v1',
        display_name: 'First Touch',
        description: 'Credits the first touchpoint within the conversion window.',
        is_operational: true,
        is_comparison: false,
      })
      .select('id')
      .single();
    modelId = (created as Record<string, string>).id;
  }

  // Find existing non-superseded result
  const { data: existingResult } = await (supabase as any)
    .schema('mih')
    .from('attribution_results')
    .select('id')
    .eq('org_id', orgId)
    .eq('conversion_event_id', conversion_event_id)
    .eq('model_id', modelId)
    .is('superseded_by_id', null)
    .single();

  const priorResultId = existingResult ? (existingResult as Record<string, string>).id : null;

  // Insert new attribution_result
  const { data: newResult } = await (supabase as any)
    .schema('mih')
    .from('attribution_results')
    .insert({
      org_id: orgId,
      conversion_event_id,
      model_id: modelId,
      cluster_id: ce.cluster_id ?? null,
      winning_source_id,
      winning_raw_lead_id: winning_raw_lead_id ?? null,
      winning_touch_at: null,
      weight: 1.0,
      reason: 'manual_override',
      rule_applied: 'manual_override',
      computation_inputs: {
        override_reason,
        notes: notes ?? null,
        overridden_by_result_id: priorResultId,
      },
    })
    .select()
    .single();

  const newResultId = (newResult as Record<string, unknown>).id as string;

  // Mark prior result superseded
  if (priorResultId) {
    await (supabase as any)
      .schema('mih')
      .from('attribution_results')
      .update({ superseded_by_id: newResultId })
      .eq('id', priorResultId);
  }

  return {
    attribution_result: newResult as Record<string, unknown>,
    superseded_id: priorResultId,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('manual attribution override', () => {
  let stub: ReturnType<typeof createSupabaseStub>;

  const BASE_ARGS: OverrideArgs = {
    orgId: 'org-1',
    conversion_event_id: 'ce-1',
    winning_source_id: 'src-manual',
    override_reason: 'Sales team confirmed direct channel',
  };

  beforeEach(() => {
    stub = createSupabaseStub();
    // Seed a conversion_event
    stub.stores.set('conversion_events', [
      { id: 'ce-1', org_id: 'org-1', cluster_id: 'cluster-1', reversed_at: null },
    ]);
  });

  it('writes a new attribution_result with reason=manual_override', async () => {
    const result = await applyManualOverride(BASE_ARGS, stub);
    const results = stub.stores.get('attribution_results') ?? [];
    expect(results.length).toBe(1);
    expect(results[0].reason).toBe('manual_override');
    expect(results[0].rule_applied).toBe('manual_override');
    expect(results[0].weight).toBe(1.0);
    expect(results[0].winning_source_id).toBe('src-manual');
    expect(result.attribution_result.reason).toBe('manual_override');
  });

  it('marks the prior attribution_result as superseded', async () => {
    // Seed existing model and result
    stub.stores.set('attribution_models', [
      { id: 'model-1', org_id: 'org-1', model_code: 'first_touch_v1', is_operational: true },
    ]);
    stub.stores.set('attribution_results', [
      {
        id: 'result-prior',
        org_id: 'org-1',
        conversion_event_id: 'ce-1',
        model_id: 'model-1',
        superseded_by_id: null,
        reason: 'first_touch',
      },
    ]);

    const result = await applyManualOverride(BASE_ARGS, stub);

    const results = stub.stores.get('attribution_results') ?? [];
    const prior = results.find((r) => r.id === 'result-prior');
    expect(prior?.superseded_by_id).toBeTruthy();
    expect(result.superseded_id).toBe('result-prior');
  });

  it('returns the new result id', async () => {
    const result = await applyManualOverride(BASE_ARGS, stub);
    expect(result.attribution_result.id).toBeTruthy();
    expect(typeof result.attribution_result.id).toBe('string');
  });

  it('returns superseded_id=null when no prior result exists', async () => {
    const result = await applyManualOverride(BASE_ARGS, stub);
    expect(result.superseded_id).toBeNull();
  });

  it('stores override_reason and notes in computation_inputs', async () => {
    const result = await applyManualOverride(
      { ...BASE_ARGS, notes: 'Confirmed by regional sales head' },
      stub,
    );
    const inputs = result.attribution_result.computation_inputs as Record<string, unknown>;
    expect(inputs.override_reason).toBe('Sales team confirmed direct channel');
    expect(inputs.notes).toBe('Confirmed by regional sales head');
  });

  it('stores overridden_by_result_id in computation_inputs when a prior result exists', async () => {
    stub.stores.set('attribution_models', [
      { id: 'model-1', org_id: 'org-1', model_code: 'first_touch_v1', is_operational: true },
    ]);
    stub.stores.set('attribution_results', [
      {
        id: 'result-prior',
        org_id: 'org-1',
        conversion_event_id: 'ce-1',
        model_id: 'model-1',
        superseded_by_id: null,
        reason: 'first_touch',
      },
    ]);

    const result = await applyManualOverride(BASE_ARGS, stub);
    const inputs = result.attribution_result.computation_inputs as Record<string, unknown>;
    expect(inputs.overridden_by_result_id).toBe('result-prior');
  });

  it('throws FORBIDDEN when manual_override_allowed=false in config', async () => {
    stub.stores.set('attribution_config', [
      { id: 'cfg-1', org_id: 'org-1', manual_override_allowed: false },
    ]);
    await expect(applyManualOverride(BASE_ARGS, stub)).rejects.toThrow('FORBIDDEN');
  });

  it('defaults to allowed when no attribution_config row exists', async () => {
    // No config row — should succeed
    await expect(applyManualOverride(BASE_ARGS, stub)).resolves.not.toThrow();
  });

  it('stores winning_raw_lead_id when provided', async () => {
    const result = await applyManualOverride(
      { ...BASE_ARGS, winning_raw_lead_id: 'raw-manual' },
      stub,
    );
    expect(result.attribution_result.winning_raw_lead_id).toBe('raw-manual');
  });
});
