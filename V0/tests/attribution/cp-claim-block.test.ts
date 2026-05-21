/**
 * Tests for CP Claim Block Rule (Spec 04 Phase 2)
 *
 * Pure function tests: no DB calls.
 * All scenarios exercise applyCpClaimBlock directly.
 */
import { describe, it, expect } from 'vitest';
import { applyCpClaimBlock } from '../../src/modules/mih-attribution/cp-claim-block.js';
import type { Touchpoint } from '../../src/modules/mih-attribution/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTp(
  overrides: Partial<Touchpoint> & { source_received_at: string; source_type: Touchpoint['source_type'] },
): Touchpoint {
  return {
    raw_lead_id: `lead-${Math.random().toString(36).slice(2)}`,
    source_id: `src-${overrides.source_type}`,
    cluster_id: 'cluster-A',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Scenario 1: CP first but non-CP existed before → CP blocked, non-CP wins
// Note: input is sorted ASC — so the non-CP here is AFTER the CP in time.
// The spec says: "if first touch is CP and there's an earlier non-CP source".
// In our sorted ASC list, "earlier" non-CP = one that appears later in list
// but the gap check uses absolute time delta — a non-CP that appeared before
// the CP would only exist if we have a non-CP entry with a smaller timestamp.
// In standard usage the list is sorted ASC so if CP is first (index 0) but
// a non-CP has a smaller timestamp, it would appear before CP — contradiction.
// The real scenario: CP pushes a lead AFTER the non-CP touch already happened.
// So the list sorted ASC: [non-CP (earlier), CP (later)]. But then CP is NOT
// first in the sorted list, so the rule doesn't fire — non-CP already wins naturally.
//
// The actual blocking scenario is:
//   - A CP sources a lead and claims it (CP touch is first in the sorted list
//     with the smallest timestamp)
//   - BUT there's evidence of a non-CP touch that happened LATER (i.e., index > 0
//     in sorted list but with a larger timestamp)
//   - gap = |cpAt - nonCpAt| > gracePeriodMinutes → block CP
//
// This represents: CP back-dated their submission so they appear first,
// but a direct online lead came in separately. We block CP if the gap is large.
// ---------------------------------------------------------------------------

describe('applyCpClaimBlock: CP first, non-CP exists later in window', () => {
  it('blocks CP when gap > grace period and returns non-CP as winner', () => {
    // CP lead at T=0, non-CP lead at T+120 min (2 hours later)
    const cpTp = makeTp({
      raw_lead_id: 'lead-cp',
      source_id: 'src-cp',
      source_type: 'cp',
      source_received_at: '2026-02-01T08:00:00Z',
    });
    const onlineTp = makeTp({
      raw_lead_id: 'lead-online',
      source_id: 'src-online',
      source_type: 'online',
      source_received_at: '2026-02-01T10:00:00Z', // 120 min later
    });

    // grace = 30 min; gap = 120 min > 30 → block
    const result = applyCpClaimBlock([cpTp, onlineTp], 30);

    expect(result.blocked).toBe(true);
    expect(result.winningTouchpoint.raw_lead_id).toBe('lead-online');
    expect(result.blockedTouchpoint?.raw_lead_id).toBe('lead-cp');
  });

  it('sets blocked=true and blockedTouchpoint is the CP entry', () => {
    const cpTp = makeTp({
      raw_lead_id: 'lead-cp-2',
      source_type: 'cp',
      source_received_at: '2026-02-01T08:00:00Z',
    });
    const onlineTp = makeTp({
      raw_lead_id: 'lead-online-2',
      source_type: 'online',
      source_received_at: '2026-02-01T12:00:00Z', // 240 min gap
    });

    const result = applyCpClaimBlock([cpTp, onlineTp], 0);

    expect(result.blocked).toBe(true);
    expect(result.blockedTouchpoint?.source_type).toBe('cp');
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: CP first, grace period allows → CP wins (not blocked)
// ---------------------------------------------------------------------------

describe('applyCpClaimBlock: CP first within grace period', () => {
  it('CP wins when gap <= grace period (not blocked)', () => {
    const cpTp = makeTp({
      raw_lead_id: 'lead-cp-grace',
      source_type: 'cp',
      source_received_at: '2026-02-01T08:00:00Z',
    });
    const onlineTp = makeTp({
      raw_lead_id: 'lead-online-grace',
      source_type: 'online',
      source_received_at: '2026-02-01T08:15:00Z', // 15 min later
    });

    // grace = 30 min; gap = 15 min → NOT blocked
    const result = applyCpClaimBlock([cpTp, onlineTp], 30);

    expect(result.blocked).toBe(false);
    expect(result.winningTouchpoint.raw_lead_id).toBe('lead-cp-grace');
    expect(result.blockedTouchpoint).toBeNull();
  });

  it('CP wins exactly at grace boundary (gap === grace period)', () => {
    const cpTp = makeTp({
      source_type: 'cp',
      source_received_at: '2026-02-01T08:00:00Z',
    });
    const onlineTp = makeTp({
      raw_lead_id: 'lead-online-exact',
      source_type: 'online',
      source_received_at: '2026-02-01T08:30:00Z', // exactly 30 min
    });

    // gap = 30 min, grace = 30 min → 30 > 30 is false → not blocked
    const result = applyCpClaimBlock([cpTp, onlineTp], 30);

    expect(result.blocked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: First touch is non-CP → returns non-CP, not blocked
// ---------------------------------------------------------------------------

describe('applyCpClaimBlock: first touch is non-CP', () => {
  it('returns non-CP as winner with blocked=false', () => {
    const onlineTp = makeTp({
      raw_lead_id: 'lead-online-first',
      source_type: 'online',
      source_received_at: '2026-02-01T08:00:00Z',
    });
    const cpTp = makeTp({
      raw_lead_id: 'lead-cp-later',
      source_type: 'cp',
      source_received_at: '2026-02-01T10:00:00Z',
    });

    const result = applyCpClaimBlock([onlineTp, cpTp], 0);

    expect(result.blocked).toBe(false);
    expect(result.winningTouchpoint.raw_lead_id).toBe('lead-online-first');
    expect(result.blockedTouchpoint).toBeNull();
  });

  it('single non-CP touchpoint: returns it as winner, blocked=false', () => {
    const onlineTp = makeTp({
      raw_lead_id: 'lead-only-online',
      source_type: 'referral',
      source_received_at: '2026-02-10T09:00:00Z',
    });

    const result = applyCpClaimBlock([onlineTp], 0);

    expect(result.blocked).toBe(false);
    expect(result.winningTouchpoint.raw_lead_id).toBe('lead-only-online');
  });

  it('walk_in source type is treated as non-CP', () => {
    const walkIn = makeTp({
      raw_lead_id: 'lead-walk-in',
      source_type: 'walk_in',
      source_received_at: '2026-02-05T10:00:00Z',
    });
    const cpTp = makeTp({
      source_type: 'cp',
      source_received_at: '2026-02-05T12:00:00Z',
    });

    const result = applyCpClaimBlock([walkIn, cpTp], 0);

    expect(result.blocked).toBe(false);
    expect(result.winningTouchpoint.raw_lead_id).toBe('lead-walk-in');
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: CP-only touchpoints → CP wins (nothing to block with)
// ---------------------------------------------------------------------------

describe('applyCpClaimBlock: CP-only touchpoints', () => {
  it('CP wins when all touchpoints are CP (nothing to block with)', () => {
    const cp1 = makeTp({
      raw_lead_id: 'lead-cp-a',
      source_type: 'cp',
      source_received_at: '2026-02-01T08:00:00Z',
    });
    const cp2 = makeTp({
      raw_lead_id: 'lead-cp-b',
      source_type: 'cp',
      source_received_at: '2026-02-05T08:00:00Z',
    });

    const result = applyCpClaimBlock([cp1, cp2], 0);

    expect(result.blocked).toBe(false);
    expect(result.winningTouchpoint.raw_lead_id).toBe('lead-cp-a');
    expect(result.blockedTouchpoint).toBeNull();
  });

  it('single CP touchpoint: CP wins, blocked=false', () => {
    const cpTp = makeTp({
      raw_lead_id: 'lead-cp-solo',
      source_type: 'cp',
      source_received_at: '2026-02-15T09:00:00Z',
    });

    const result = applyCpClaimBlock([cpTp], 0);

    expect(result.blocked).toBe(false);
    expect(result.winningTouchpoint.raw_lead_id).toBe('lead-cp-solo');
  });

  it('CP-only with large gap still does not block', () => {
    const cp1 = makeTp({
      raw_lead_id: 'lead-cp-first',
      source_type: 'cp',
      source_received_at: '2026-01-01T08:00:00Z',
    });
    const cp2 = makeTp({
      raw_lead_id: 'lead-cp-second',
      source_type: 'cp',
      source_received_at: '2026-02-01T08:00:00Z',
    });

    const result = applyCpClaimBlock([cp1, cp2], 0);

    expect(result.blocked).toBe(false);
    expect(result.winningTouchpoint.raw_lead_id).toBe('lead-cp-first');
  });
});

// ---------------------------------------------------------------------------
// Edge: grace period = 0 means any gap > 0 triggers block
// ---------------------------------------------------------------------------

describe('applyCpClaimBlock: zero grace period', () => {
  it('any positive gap triggers block when grace=0', () => {
    const cpTp = makeTp({
      raw_lead_id: 'lead-cp-zero',
      source_type: 'cp',
      source_received_at: '2026-02-01T08:00:00Z',
    });
    const onlineTp = makeTp({
      raw_lead_id: 'lead-online-zero',
      source_type: 'online',
      source_received_at: '2026-02-01T08:00:01Z', // 1 second later — gap > 0
    });

    const result = applyCpClaimBlock([cpTp, onlineTp], 0);

    expect(result.blocked).toBe(true);
    expect(result.winningTouchpoint.raw_lead_id).toBe('lead-online-zero');
  });
});
