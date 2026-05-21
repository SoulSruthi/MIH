/**
 * Tests for comparison attribution models — Last-Touch and Time-Decay (Spec 04 V2.2)
 *
 * Pure function tests: no DB calls. All data is passed directly.
 */
import { describe, it, expect } from 'vitest';
import {
  computeLastTouchDecision,
  computeTimeDecayDecision,
} from '../../src/modules/mih-attribution/comparison-models.js';
import type { Touchpoint } from '../../src/modules/mih-attribution/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONVERSION_AT = '2026-03-01T12:00:00Z';
const WINDOW_DAYS = 60;

function makeTp(
  overrides: Partial<Touchpoint> & { raw_lead_id: string; source_received_at: string },
): Touchpoint {
  return {
    source_id: `src-${overrides.raw_lead_id}`,
    source_type: 'online',
    cluster_id: 'cluster-A',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeLastTouchDecision
// ---------------------------------------------------------------------------

describe('computeLastTouchDecision', () => {
  // -------------------------------------------------------------------------
  // Single touchpoint → returns it
  // -------------------------------------------------------------------------
  describe('single touchpoint', () => {
    it('returns the single touchpoint as winner', () => {
      const tp = makeTp({ raw_lead_id: 'lead-solo', source_received_at: '2026-02-15T09:00:00Z' });

      const result = computeLastTouchDecision([tp], CONVERSION_AT, WINDOW_DAYS);

      expect(result.winning_raw_lead_id).toBe('lead-solo');
      expect(result.winning_source_id).toBe('src-lead-solo');
      expect(result.winning_touch_at).toBe('2026-02-15T09:00:00Z');
      expect(result.weight).toBe(1.0);
      expect(result.reason).toBe('last_touch');
      expect(result.rule_applied).toBe('last_touch_v1');
    });

    it('computation_inputs includes window_cutoff and the touchpoint', () => {
      const tp = makeTp({ raw_lead_id: 'lead-x', source_received_at: '2026-02-20T08:00:00Z' });

      const result = computeLastTouchDecision([tp], CONVERSION_AT, WINDOW_DAYS);

      expect(result.computation_inputs.window_cutoff).toBeTruthy();
      expect(result.computation_inputs.touchpoints_considered).toHaveLength(1);
      expect(result.computation_inputs.cp_block_fired).toBe(false);
      expect(result.computation_inputs.household_rule_fired).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Multiple touchpoints → returns latest (last element of ASC-sorted input)
  // -------------------------------------------------------------------------
  describe('multiple touchpoints', () => {
    it('returns the LATEST touchpoint when multiple are provided (ASC sorted input)', () => {
      const early = makeTp({ raw_lead_id: 'lead-early', source_received_at: '2026-01-10T08:00:00Z' });
      const mid = makeTp({ raw_lead_id: 'lead-mid', source_received_at: '2026-02-01T08:00:00Z' });
      const late = makeTp({ raw_lead_id: 'lead-late', source_received_at: '2026-02-25T08:00:00Z' });

      // Input is ASC sorted (as guaranteed by caller / runner)
      const result = computeLastTouchDecision([early, mid, late], CONVERSION_AT, WINDOW_DAYS);

      expect(result.winning_raw_lead_id).toBe('lead-late');
      expect(result.winning_touch_at).toBe('2026-02-25T08:00:00Z');
    });

    it('returns latest even when only two touchpoints are given', () => {
      const first = makeTp({ raw_lead_id: 'lead-first', source_received_at: '2026-01-05T10:00:00Z' });
      const last = makeTp({ raw_lead_id: 'lead-last', source_received_at: '2026-02-28T10:00:00Z' });

      const result = computeLastTouchDecision([first, last], CONVERSION_AT, WINDOW_DAYS);

      expect(result.winning_raw_lead_id).toBe('lead-last');
    });

    it('weight is 1.0 for multiple touchpoints (attribution share)', () => {
      const tps = [
        makeTp({ raw_lead_id: 'a', source_received_at: '2026-01-15T00:00:00Z' }),
        makeTp({ raw_lead_id: 'b', source_received_at: '2026-02-15T00:00:00Z' }),
      ];

      const result = computeLastTouchDecision(tps, CONVERSION_AT, WINDOW_DAYS);

      expect(result.weight).toBe(1.0);
    });

    it('touchpoints_considered contains all provided touchpoints', () => {
      const tps = [
        makeTp({ raw_lead_id: 'p', source_received_at: '2026-01-20T00:00:00Z' }),
        makeTp({ raw_lead_id: 'q', source_received_at: '2026-02-10T00:00:00Z' }),
        makeTp({ raw_lead_id: 'r', source_received_at: '2026-02-20T00:00:00Z' }),
      ];

      const result = computeLastTouchDecision(tps, CONVERSION_AT, WINDOW_DAYS);

      expect(result.computation_inputs.touchpoints_considered).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // Empty touchpoints → null winning fields
  // -------------------------------------------------------------------------
  describe('empty touchpoints', () => {
    it('returns null winning fields for empty input', () => {
      const result = computeLastTouchDecision([], CONVERSION_AT, WINDOW_DAYS);

      expect(result.winning_raw_lead_id).toBeNull();
      expect(result.winning_source_id).toBeNull();
      expect(result.winning_touch_at).toBeNull();
      expect(result.weight).toBe(0);
      expect(result.reason).toBe('no_touchpoints_in_window');
      expect(result.rule_applied).toBe('last_touch_v1');
    });

    it('empty result still includes window_cutoff in computation_inputs', () => {
      const result = computeLastTouchDecision([], CONVERSION_AT, WINDOW_DAYS);

      expect(result.computation_inputs.window_cutoff).toBeTruthy();
      expect(result.computation_inputs.touchpoints_considered).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// computeTimeDecayDecision
// ---------------------------------------------------------------------------

describe('computeTimeDecayDecision', () => {
  // -------------------------------------------------------------------------
  // Single touchpoint → returns it
  // -------------------------------------------------------------------------
  describe('single touchpoint', () => {
    it('returns the single touchpoint as winner', () => {
      const tp = makeTp({ raw_lead_id: 'lead-only', source_received_at: '2026-02-22T09:00:00Z' });

      const result = computeTimeDecayDecision([tp], CONVERSION_AT, WINDOW_DAYS);

      expect(result.winning_raw_lead_id).toBe('lead-only');
      expect(result.winning_source_id).toBe('src-lead-only');
      expect(result.winning_touch_at).toBe('2026-02-22T09:00:00Z');
      expect(result.weight).toBe(1.0);
      expect(result.reason).toBe('time_decay');
      expect(result.rule_applied).toBe('time_decay_v1');
    });

    it('weight is 1.0 (attribution share, not decay score)', () => {
      const tp = makeTp({ raw_lead_id: 'lead-w', source_received_at: '2026-02-01T00:00:00Z' });

      const result = computeTimeDecayDecision([tp], CONVERSION_AT, WINDOW_DAYS);

      expect(result.weight).toBe(1.0);
    });
  });

  // -------------------------------------------------------------------------
  // Most recent touchpoint wins (highest decay weight)
  // -------------------------------------------------------------------------
  describe('multiple touchpoints — most recent wins', () => {
    it('picks the most recent touchpoint (closest to conversion)', () => {
      // Older touch has lower decay weight → newer touch wins
      const old = makeTp({ raw_lead_id: 'lead-old', source_received_at: '2026-01-01T00:00:00Z' }); // ~59 days before
      const recent = makeTp({ raw_lead_id: 'lead-recent', source_received_at: '2026-02-28T00:00:00Z' }); // ~1 day before

      const result = computeTimeDecayDecision([old, recent], CONVERSION_AT, WINDOW_DAYS);

      expect(result.winning_raw_lead_id).toBe('lead-recent');
    });

    it('returns most-recent even with three touchpoints at different ages', () => {
      const t1 = makeTp({ raw_lead_id: 'lead-t1', source_received_at: '2026-01-10T00:00:00Z' }); // ~50 days before
      const t2 = makeTp({ raw_lead_id: 'lead-t2', source_received_at: '2026-02-10T00:00:00Z' }); // ~19 days before
      const t3 = makeTp({ raw_lead_id: 'lead-t3', source_received_at: '2026-02-27T00:00:00Z' }); // ~2 days before

      const result = computeTimeDecayDecision([t1, t2, t3], CONVERSION_AT, WINDOW_DAYS);

      expect(result.winning_raw_lead_id).toBe('lead-t3');
    });

    it('weight is always 1.0 regardless of which touchpoint wins', () => {
      const early = makeTp({ raw_lead_id: 'lead-e', source_received_at: '2026-01-15T00:00:00Z' });
      const late = makeTp({ raw_lead_id: 'lead-l', source_received_at: '2026-02-25T00:00:00Z' });

      const result = computeTimeDecayDecision([early, late], CONVERSION_AT, WINDOW_DAYS);

      expect(result.weight).toBe(1.0);
    });
  });

  // -------------------------------------------------------------------------
  // lambda=0.1 → touch 7 days ago has half the weight of touch today
  // (half-life = ln(2)/0.1 ≈ 6.93 days)
  // -------------------------------------------------------------------------
  describe('time-decay weight behaviour (lambda=0.1)', () => {
    it('touch ~7 days ago has roughly half the decay weight of a same-day touch', () => {
      // Conversion at 2026-03-01T12:00:00Z
      // Touch 7 days before: weight = e^(-0.1 * 7) ≈ 0.4966
      // Touch 0 days before (same moment): weight = e^0 = 1.0
      // So same-day touch > 7-day touch → same-day should win
      const sevenDaysAgo = makeTp({
        raw_lead_id: 'lead-7d',
        source_received_at: '2026-02-22T12:00:00Z', // exactly 7 days before
      });
      const sameDay = makeTp({
        raw_lead_id: 'lead-0d',
        source_received_at: '2026-03-01T12:00:00Z', // same moment as conversion
      });

      const result = computeTimeDecayDecision([sevenDaysAgo, sameDay], CONVERSION_AT, WINDOW_DAYS);

      expect(result.winning_raw_lead_id).toBe('lead-0d');
    });

    it('with only the 7-day touch, it still wins (trivially)', () => {
      const tp = makeTp({ raw_lead_id: 'lead-7d-only', source_received_at: '2026-02-22T12:00:00Z' });

      const result = computeTimeDecayDecision([tp], CONVERSION_AT, WINDOW_DAYS);

      expect(result.winning_raw_lead_id).toBe('lead-7d-only');
      expect(result.weight).toBe(1.0);
    });
  });

  // -------------------------------------------------------------------------
  // Empty touchpoints → null winning fields
  // -------------------------------------------------------------------------
  describe('empty touchpoints', () => {
    it('returns null winning fields for empty input', () => {
      const result = computeTimeDecayDecision([], CONVERSION_AT, WINDOW_DAYS);

      expect(result.winning_raw_lead_id).toBeNull();
      expect(result.winning_source_id).toBeNull();
      expect(result.winning_touch_at).toBeNull();
      expect(result.weight).toBe(0);
      expect(result.reason).toBe('no_touchpoints_in_window');
      expect(result.rule_applied).toBe('time_decay_v1');
    });

    it('empty result still includes window_cutoff in computation_inputs', () => {
      const result = computeTimeDecayDecision([], CONVERSION_AT, WINDOW_DAYS);

      expect(result.computation_inputs.window_cutoff).toBeTruthy();
      expect(result.computation_inputs.touchpoints_considered).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // computation_inputs shape
  // -------------------------------------------------------------------------
  describe('computation_inputs', () => {
    it('contains all provided touchpoints, window_cutoff, and false flags', () => {
      const tps = [
        makeTp({ raw_lead_id: 'td-a', source_received_at: '2026-02-01T00:00:00Z' }),
        makeTp({ raw_lead_id: 'td-b', source_received_at: '2026-02-20T00:00:00Z' }),
      ];

      const result = computeTimeDecayDecision(tps, CONVERSION_AT, WINDOW_DAYS);

      expect(result.computation_inputs.touchpoints_considered).toHaveLength(2);
      expect(result.computation_inputs.window_cutoff).toBeTruthy();
      expect(result.computation_inputs.cp_block_fired).toBe(false);
      expect(result.computation_inputs.household_rule_fired).toBe(false);
    });
  });
});
