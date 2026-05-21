/**
 * Comparison attribution models — Last-Touch and Time-Decay (Spec 04 V2.2)
 *
 * Pure functions: no DB calls. All data is passed in.
 */
import type { Touchpoint, AttributionDecision } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildWindowCutoff(conversionOccurredAt: string, windowDays: number): string {
  const conversionMs = new Date(conversionOccurredAt).getTime();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return new Date(conversionMs - windowMs).toISOString();
}

// ---------------------------------------------------------------------------
// Last-Touch
// ---------------------------------------------------------------------------

/**
 * Last-touch: pick the LATEST touchpoint within the window (by source_received_at DESC).
 */
export function computeLastTouchDecision(
  touchpoints: Touchpoint[], // already filtered within window, sorted ASC
  conversionOccurredAt: string,
  windowDays: number,
): AttributionDecision {
  const windowCutoff = buildWindowCutoff(conversionOccurredAt, windowDays);

  if (touchpoints.length === 0) {
    return {
      winning_raw_lead_id: null,
      winning_source_id: null,
      winning_touch_at: null,
      weight: 0,
      reason: 'no_touchpoints_in_window',
      rule_applied: 'last_touch_v1',
      computation_inputs: {
        touchpoints_considered: [],
        window_cutoff: windowCutoff,
        cp_block_fired: false,
        household_rule_fired: false,
      },
    };
  }

  // Latest is the last element when sorted ASC
  const winner = touchpoints[touchpoints.length - 1];

  return {
    winning_raw_lead_id: winner.raw_lead_id,
    winning_source_id: winner.source_id,
    winning_touch_at: winner.source_received_at,
    weight: 1.0,
    reason: 'last_touch',
    rule_applied: 'last_touch_v1',
    computation_inputs: {
      touchpoints_considered: touchpoints,
      window_cutoff: windowCutoff,
      cp_block_fired: false,
      household_rule_fired: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Time-Decay
// ---------------------------------------------------------------------------

const LAMBDA = 0.1; // half-life ≈ ln(2)/0.1 ≈ 6.93 days

/**
 * Time-decay: weight = e^(-lambda * days_before_conversion).
 * lambda = 0.1 (half-life ≈ 7 days).
 * Winner = touchpoint with highest weight (i.e. most recent non-zero weight touch).
 * If all weights are equal (single touchpoint) just return that touchpoint.
 */
export function computeTimeDecayDecision(
  touchpoints: Touchpoint[], // already filtered within window, sorted ASC
  conversionOccurredAt: string,
  windowDays: number,
): AttributionDecision {
  const windowCutoff = buildWindowCutoff(conversionOccurredAt, windowDays);

  if (touchpoints.length === 0) {
    return {
      winning_raw_lead_id: null,
      winning_source_id: null,
      winning_touch_at: null,
      weight: 0,
      reason: 'no_touchpoints_in_window',
      rule_applied: 'time_decay_v1',
      computation_inputs: {
        touchpoints_considered: [],
        window_cutoff: windowCutoff,
        cp_block_fired: false,
        household_rule_fired: false,
      },
    };
  }

  const conversionMs = new Date(conversionOccurredAt).getTime();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  let bestWeight = -Infinity;
  let winner = touchpoints[0];

  for (const tp of touchpoints) {
    const daysBefore = (conversionMs - new Date(tp.source_received_at).getTime()) / MS_PER_DAY;
    const w = Math.exp(-LAMBDA * daysBefore);
    if (w > bestWeight) {
      bestWeight = w;
      winner = tp;
    }
  }

  return {
    winning_raw_lead_id: winner.raw_lead_id,
    winning_source_id: winner.source_id,
    winning_touch_at: winner.source_received_at,
    weight: 1.0, // attribution share, not decay score
    reason: 'time_decay',
    rule_applied: 'time_decay_v1',
    computation_inputs: {
      touchpoints_considered: touchpoints,
      window_cutoff: windowCutoff,
      cp_block_fired: false,
      household_rule_fired: false,
    },
  };
}
