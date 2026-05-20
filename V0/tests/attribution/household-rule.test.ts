/**
 * Tests for Household First-Member Rule (Spec 04 Phase 2)
 *
 * Pure function tests: no DB calls.
 * All scenarios exercise applyHouseholdRule directly.
 */
import { describe, it, expect } from 'vitest';
import { applyHouseholdRule } from '../../src/modules/mih-attribution/household-rule.js';
import type { Touchpoint } from '../../src/modules/mih-attribution/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTp(
  overrides: Partial<Touchpoint> & { source_received_at: string; cluster_id: string },
): Touchpoint {
  return {
    raw_lead_id: `lead-${Math.random().toString(36).slice(2)}`,
    source_id: `src-${overrides.cluster_id}`,
    source_type: 'online',
    ...overrides,
  };
}

function sortAsc(touchpoints: Touchpoint[]): Touchpoint[] {
  return [...touchpoints].sort((a, b) =>
    a.source_received_at.localeCompare(b.source_received_at),
  );
}

// ---------------------------------------------------------------------------
// Scenario 1: Earliest touch from different cluster → household rule fires
// ---------------------------------------------------------------------------

describe('applyHouseholdRule: earliest touch from different cluster', () => {
  it('fires household rule and returns the earliest touchpoint from the other cluster', () => {
    // Household cluster B has the earliest touch
    const tpClusterB = makeTp({
      raw_lead_id: 'lead-hh-B',
      source_id: 'src-B',
      cluster_id: 'cluster-B',
      source_received_at: '2026-01-01T08:00:00Z', // earliest
    });
    const tpClusterA = makeTp({
      raw_lead_id: 'lead-converting-A',
      source_id: 'src-A',
      cluster_id: 'cluster-A', // converting cluster
      source_received_at: '2026-01-10T08:00:00Z',
    });

    const allTouchpoints = sortAsc([tpClusterA, tpClusterB]);
    const result = applyHouseholdRule('cluster-A', allTouchpoints);

    expect(result.householdRuleFired).toBe(true);
    expect(result.winningTouchpoint.raw_lead_id).toBe('lead-hh-B');
    expect(result.householdClusterUsed).toBe('cluster-B');
  });

  it('householdClusterUsed is set to the winning household cluster id', () => {
    const tpC = makeTp({
      raw_lead_id: 'lead-C',
      cluster_id: 'cluster-C',
      source_received_at: '2026-01-05T09:00:00Z',
    });
    const tpA = makeTp({
      raw_lead_id: 'lead-A',
      cluster_id: 'cluster-A',
      source_received_at: '2026-01-20T09:00:00Z',
    });

    const result = applyHouseholdRule('cluster-A', sortAsc([tpA, tpC]));

    expect(result.householdClusterUsed).toBe('cluster-C');
  });

  it('winning touchpoint source details match the household cluster entry', () => {
    const tpB = makeTp({
      raw_lead_id: 'lead-hh-detail',
      source_id: 'src-hh-detail',
      source_type: 'referral',
      cluster_id: 'cluster-B',
      source_received_at: '2026-01-03T10:00:00Z',
    });
    const tpA = makeTp({
      raw_lead_id: 'lead-A-late',
      cluster_id: 'cluster-A',
      source_received_at: '2026-01-15T10:00:00Z',
    });

    const result = applyHouseholdRule('cluster-A', sortAsc([tpA, tpB]));

    expect(result.winningTouchpoint.source_id).toBe('src-hh-detail');
    expect(result.winningTouchpoint.source_type).toBe('referral');
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Earliest touch from converting cluster → no household rule
// ---------------------------------------------------------------------------

describe('applyHouseholdRule: earliest touch from converting cluster', () => {
  it('does not fire household rule when converting cluster has the earliest touch', () => {
    const tpA = makeTp({
      raw_lead_id: 'lead-A-first',
      cluster_id: 'cluster-A', // converting cluster — earliest
      source_received_at: '2026-01-01T08:00:00Z',
    });
    const tpB = makeTp({
      raw_lead_id: 'lead-B-later',
      cluster_id: 'cluster-B',
      source_received_at: '2026-01-10T08:00:00Z',
    });

    const result = applyHouseholdRule('cluster-A', sortAsc([tpA, tpB]));

    expect(result.householdRuleFired).toBe(false);
    expect(result.householdClusterUsed).toBeNull();
  });

  it('returns the converting cluster touchpoint as winner', () => {
    const tpA = makeTp({
      raw_lead_id: 'lead-A-winner',
      source_id: 'src-A-winner',
      cluster_id: 'cluster-A',
      source_received_at: '2026-01-01T08:00:00Z',
    });
    const tpB = makeTp({
      raw_lead_id: 'lead-B-not-winner',
      cluster_id: 'cluster-B',
      source_received_at: '2026-02-01T08:00:00Z',
    });

    const result = applyHouseholdRule('cluster-A', sortAsc([tpA, tpB]));

    expect(result.winningTouchpoint.raw_lead_id).toBe('lead-A-winner');
  });

  it('single touchpoint from converting cluster: no household rule', () => {
    const tpA = makeTp({
      raw_lead_id: 'lead-A-solo',
      cluster_id: 'cluster-A',
      source_received_at: '2026-02-10T10:00:00Z',
    });

    const result = applyHouseholdRule('cluster-A', [tpA]);

    expect(result.householdRuleFired).toBe(false);
    expect(result.winningTouchpoint.raw_lead_id).toBe('lead-A-solo');
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Mixed touches across clusters → globally earliest wins
// ---------------------------------------------------------------------------

describe('applyHouseholdRule: mixed touches across multiple clusters', () => {
  it('globally earliest touchpoint wins regardless of cluster count', () => {
    const tpA = makeTp({
      raw_lead_id: 'lead-A',
      cluster_id: 'cluster-A',
      source_received_at: '2026-01-15T10:00:00Z',
    });
    const tpB = makeTp({
      raw_lead_id: 'lead-B',
      cluster_id: 'cluster-B',
      source_received_at: '2026-01-10T10:00:00Z',
    });
    const tpC = makeTp({
      raw_lead_id: 'lead-C',
      cluster_id: 'cluster-C',
      source_received_at: '2026-01-05T10:00:00Z', // globally earliest
    });

    const allSorted = sortAsc([tpA, tpB, tpC]);
    const result = applyHouseholdRule('cluster-A', allSorted);

    expect(result.winningTouchpoint.raw_lead_id).toBe('lead-C');
    expect(result.householdRuleFired).toBe(true);
    expect(result.householdClusterUsed).toBe('cluster-C');
  });

  it('fires when first of many clusters wins, not just the single household partner', () => {
    const tps = [
      makeTp({ raw_lead_id: 'lead-D', cluster_id: 'cluster-D', source_received_at: '2026-01-01T00:00:00Z' }),
      makeTp({ raw_lead_id: 'lead-B', cluster_id: 'cluster-B', source_received_at: '2026-01-02T00:00:00Z' }),
      makeTp({ raw_lead_id: 'lead-A', cluster_id: 'cluster-A', source_received_at: '2026-01-03T00:00:00Z' }),
      makeTp({ raw_lead_id: 'lead-C', cluster_id: 'cluster-C', source_received_at: '2026-01-04T00:00:00Z' }),
    ];

    const result = applyHouseholdRule('cluster-A', sortAsc(tps));

    expect(result.householdRuleFired).toBe(true);
    expect(result.householdClusterUsed).toBe('cluster-D');
    expect(result.winningTouchpoint.raw_lead_id).toBe('lead-D');
  });

  it('does not fire when converting cluster is globally earliest among many clusters', () => {
    const tps = [
      makeTp({ raw_lead_id: 'lead-A-early', cluster_id: 'cluster-A', source_received_at: '2025-12-20T00:00:00Z' }),
      makeTp({ raw_lead_id: 'lead-B', cluster_id: 'cluster-B', source_received_at: '2026-01-05T00:00:00Z' }),
      makeTp({ raw_lead_id: 'lead-C', cluster_id: 'cluster-C', source_received_at: '2026-01-10T00:00:00Z' }),
    ];

    const result = applyHouseholdRule('cluster-A', sortAsc(tps));

    expect(result.householdRuleFired).toBe(false);
    expect(result.winningTouchpoint.raw_lead_id).toBe('lead-A-early');
    expect(result.householdClusterUsed).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Edge: same timestamp ties
// ---------------------------------------------------------------------------

describe('applyHouseholdRule: timestamp tie-breaking', () => {
  it('when timestamps are equal: localeCompare sort determines order; converting cluster can still win', () => {
    // Both have exact same timestamp — sort is stable/lexicographic on ISO string
    const tpA = makeTp({
      raw_lead_id: 'lead-A-tie',
      cluster_id: 'cluster-A',
      source_received_at: '2026-01-10T08:00:00Z',
    });
    const tpB = makeTp({
      raw_lead_id: 'lead-B-tie',
      cluster_id: 'cluster-B',
      source_received_at: '2026-01-10T08:00:00Z', // same time
    });

    // The rule picks [0] from the sorted array. With same timestamps the sort
    // is stable but order depends on position — just verify winner is set.
    const result = applyHouseholdRule('cluster-A', [tpA, tpB]);

    // Regardless of which wins, we get a valid touchpoint back
    expect(result.winningTouchpoint).toBeTruthy();
    expect(result.winningTouchpoint.source_received_at).toBe('2026-01-10T08:00:00Z');
  });
});
