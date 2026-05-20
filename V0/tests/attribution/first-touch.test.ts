/**
 * Tests for MIH Attribution Engine — First-Touch Model (Spec 04 Phase 2)
 *
 * Pure function tests: no DB calls, no mocking required.
 * All scenarios pass data directly into computeFirstTouchAttribution.
 */
import { describe, it, expect } from 'vitest';
import { computeFirstTouchAttribution } from '../../src/modules/mih-attribution/engine.js';
import type {
  AttributionEngineInput,
  Touchpoint,
} from '../../src/modules/mih-attribution/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(
  overrides: Partial<AttributionEngineInput['config']> = {},
): AttributionEngineInput['config'] {
  return {
    conversion_window_days: 60,
    household_rule_enabled: false,
    cp_claim_block_rule_enabled: false,
    cp_claim_grace_minutes: 0,
    ...overrides,
  };
}

function makeInput(
  overrides: Partial<Omit<AttributionEngineInput, 'config'>> & {
    config?: Partial<AttributionEngineInput['config']>;
  } = {},
): AttributionEngineInput {
  const { config: configOverrides, ...rest } = overrides;
  return {
    orgId: 'org-test',
    conversionEventId: 'evt-001',
    convertingClusterId: 'cluster-A',
    conversionOccurredAt: '2026-03-01T12:00:00Z', // day 60 reference point
    config: makeConfig(configOverrides),
    modelCode: 'first_touch_v1',
    ...rest,
  };
}

function makeTouchpoint(overrides: Partial<Touchpoint> & { source_received_at: string }): Touchpoint {
  return {
    raw_lead_id: `lead-${Math.random().toString(36).slice(2)}`,
    source_id: 'src-online',
    source_type: 'online',
    cluster_id: 'cluster-A',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Scenario 1: Online lead day 1, CP push day 30 — both within 60-day window
// First touch (online) should win.
// ---------------------------------------------------------------------------

describe('first-touch: online day 1 + CP day 30 within 60-day window', () => {
  it('online lead wins (first-touch)', () => {
    const input = makeInput({
      conversionOccurredAt: '2026-03-01T12:00:00Z',
    });

    const onlineLead = makeTouchpoint({
      raw_lead_id: 'lead-online',
      source_id: 'src-online',
      source_type: 'online',
      source_received_at: '2026-01-01T08:00:00Z', // day 1 (60 days before conversion)
      cluster_id: 'cluster-A',
    });

    const cpPush = makeTouchpoint({
      raw_lead_id: 'lead-cp',
      source_id: 'src-cp',
      source_type: 'cp',
      source_received_at: '2026-01-31T08:00:00Z', // day 30
      cluster_id: 'cluster-A',
    });

    const result = computeFirstTouchAttribution(input, [onlineLead, cpPush], []);

    expect(result.decision.winning_raw_lead_id).toBe('lead-online');
    expect(result.decision.winning_source_id).toBe('src-online');
    expect(result.decision.reason).toBe('first_touch');
    expect(result.modelCode).toBe('first_touch_v1');
  });

  it('weight is 1 for a single winning touchpoint', () => {
    const input = makeInput();
    const tp = makeTouchpoint({ source_received_at: '2026-01-15T10:00:00Z' });

    const result = computeFirstTouchAttribution(input, [tp], []);

    expect(result.decision.weight).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Online lead day 1 + CP push day 61 — online outside window
// CP (within window) wins because online is before the cutoff.
// ---------------------------------------------------------------------------

describe('first-touch: online day 1 + CP day 61 with window=60', () => {
  it('CP wins because online lead is outside the 60-day window', () => {
    // conversionOccurredAt = 2026-03-02
    // 60-day window cutoff = 2026-01-01
    // online lead = 2025-12-31 (before cutoff, outside window)
    // cp push   = 2026-02-01 (inside window)
    const input = makeInput({
      conversionOccurredAt: '2026-03-02T00:00:00Z',
      config: { conversion_window_days: 60 },
    });

    const onlineLead = makeTouchpoint({
      raw_lead_id: 'lead-online-old',
      source_id: 'src-online',
      source_type: 'online',
      source_received_at: '2025-12-31T23:59:00Z', // day 61 before conversion — outside window
      cluster_id: 'cluster-A',
    });

    const cpPush = makeTouchpoint({
      raw_lead_id: 'lead-cp-new',
      source_id: 'src-cp',
      source_type: 'cp',
      source_received_at: '2026-02-01T08:00:00Z', // inside window
      cluster_id: 'cluster-A',
    });

    const result = computeFirstTouchAttribution(input, [onlineLead, cpPush], []);

    expect(result.decision.winning_raw_lead_id).toBe('lead-cp-new');
    expect(result.decision.winning_source_id).toBe('src-cp');
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Empty touchpoints → null winning fields
// ---------------------------------------------------------------------------

describe('first-touch: empty touchpoints', () => {
  it('returns null winning fields when no touchpoints provided', () => {
    const input = makeInput();
    const result = computeFirstTouchAttribution(input, [], []);

    expect(result.decision.winning_raw_lead_id).toBeNull();
    expect(result.decision.winning_source_id).toBeNull();
    expect(result.decision.winning_touch_at).toBeNull();
    expect(result.decision.weight).toBe(0);
    expect(result.decision.reason).toBe('no_touchpoints_in_window');
  });

  it('returns null winning fields when all touchpoints are outside window', () => {
    const input = makeInput({ conversionOccurredAt: '2026-03-01T00:00:00Z' });

    const oldTp = makeTouchpoint({
      source_received_at: '2025-01-01T00:00:00Z', // well outside 60-day window
    });

    const result = computeFirstTouchAttribution(input, [oldTp], []);

    expect(result.decision.winning_raw_lead_id).toBeNull();
  });

  it('computation_inputs includes window_cutoff even on empty result', () => {
    const input = makeInput({
      conversionOccurredAt: '2026-03-01T12:00:00Z',
      config: { conversion_window_days: 60 },
    });

    const result = computeFirstTouchAttribution(input, [], []);

    expect(result.decision.computation_inputs.window_cutoff).toBeTruthy();
    expect(result.decision.computation_inputs.cp_block_fired).toBe(false);
    expect(result.decision.computation_inputs.household_rule_fired).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Single touchpoint → that touchpoint wins
// ---------------------------------------------------------------------------

describe('first-touch: single touchpoint', () => {
  it('single touchpoint always wins', () => {
    const input = makeInput();
    const tp = makeTouchpoint({
      raw_lead_id: 'lead-solo',
      source_id: 'src-solo',
      source_received_at: '2026-02-15T09:00:00Z',
    });

    const result = computeFirstTouchAttribution(input, [tp], []);

    expect(result.decision.winning_raw_lead_id).toBe('lead-solo');
    expect(result.decision.winning_source_id).toBe('src-solo');
    expect(result.decision.winning_touch_at).toBe('2026-02-15T09:00:00Z');
  });

  it('single touchpoint: winning_touch_at matches source_received_at', () => {
    const input = makeInput();
    const tp = makeTouchpoint({ source_received_at: '2026-02-20T11:30:00Z' });

    const result = computeFirstTouchAttribution(input, [tp], []);

    expect(result.decision.winning_touch_at).toBe('2026-02-20T11:30:00Z');
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: Multiple online sources → earliest wins
// ---------------------------------------------------------------------------

describe('first-touch: multiple online sources', () => {
  it('picks the earliest source_received_at among multiple online touchpoints', () => {
    const input = makeInput();

    const tp1 = makeTouchpoint({
      raw_lead_id: 'lead-third',
      source_received_at: '2026-02-20T10:00:00Z',
      source_type: 'online',
    });
    const tp2 = makeTouchpoint({
      raw_lead_id: 'lead-first',
      source_id: 'src-first',
      source_received_at: '2026-01-15T08:00:00Z', // earliest
      source_type: 'online',
    });
    const tp3 = makeTouchpoint({
      raw_lead_id: 'lead-second',
      source_received_at: '2026-02-01T09:00:00Z',
      source_type: 'online',
    });

    const result = computeFirstTouchAttribution(input, [tp1, tp2, tp3], []);

    expect(result.decision.winning_raw_lead_id).toBe('lead-first');
    expect(result.decision.winning_source_id).toBe('src-first');
  });

  it('touchpoints_considered in computation_inputs contains all in-window touches', () => {
    const input = makeInput();

    const tps = [
      makeTouchpoint({ raw_lead_id: 'lead-a', source_received_at: '2026-01-10T08:00:00Z' }),
      makeTouchpoint({ raw_lead_id: 'lead-b', source_received_at: '2026-02-10T08:00:00Z' }),
    ];

    const result = computeFirstTouchAttribution(input, tps, []);

    expect(result.decision.computation_inputs.touchpoints_considered).toHaveLength(2);
  });

  it('ordering does not matter — earliest timestamp wins regardless of input order', () => {
    const input = makeInput();

    // Supply in reverse chronological order
    const tps = [
      makeTouchpoint({ raw_lead_id: 'lead-late', source_received_at: '2026-02-28T10:00:00Z' }),
      makeTouchpoint({ raw_lead_id: 'lead-mid', source_received_at: '2026-02-15T10:00:00Z' }),
      makeTouchpoint({ raw_lead_id: 'lead-early', source_received_at: '2026-01-20T10:00:00Z' }),
    ];

    const result = computeFirstTouchAttribution(input, tps, []);

    expect(result.decision.winning_raw_lead_id).toBe('lead-early');
  });
});

// ---------------------------------------------------------------------------
// Scenario 6: modelCode is passed through to result
// ---------------------------------------------------------------------------

describe('first-touch: modelCode passthrough', () => {
  it('result modelCode matches input modelCode', () => {
    const input = makeInput({ modelCode: 'first_touch_v1' });
    const tp = makeTouchpoint({ source_received_at: '2026-02-01T00:00:00Z' });

    const result = computeFirstTouchAttribution(input, [tp], []);

    expect(result.modelCode).toBe('first_touch_v1');
  });
});
