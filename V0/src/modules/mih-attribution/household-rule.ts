/**
 * Household First-Member Rule (Spec 04 Phase 2)
 *
 * When multiple identity clusters belong to the same household
 * (e.g., spouse, parent/child at the same address), attribution
 * should go to the cluster whose member first touched a source —
 * regardless of which cluster member converted.
 *
 * Input touchpoints must be pre-sorted by source_received_at ASC
 * and include touchpoints from both the converting cluster and all
 * household-linked clusters.
 */
import type { Touchpoint } from './types';

export type HouseholdRuleResult = {
  winningTouchpoint: Touchpoint;
  householdRuleFired: boolean;
  householdClusterUsed: string | null;
};

/**
 * Applies the household first-member rule.
 *
 * Logic:
 * - Sort is assumed to have been done by the caller (source_received_at ASC)
 * - If the globally earliest touchpoint belongs to the convertingClusterId → no override
 * - If it belongs to a different cluster → household rule fires → that cluster wins
 */
export function applyHouseholdRule(
  convertingClusterId: string,
  allTouchpoints: Touchpoint[], // sorted by source_received_at ASC
): HouseholdRuleResult {
  if (allTouchpoints.length === 0) {
    throw new Error('applyHouseholdRule: allTouchpoints array must not be empty');
  }

  const earliest = allTouchpoints[0];

  if (earliest.cluster_id === convertingClusterId) {
    return {
      winningTouchpoint: earliest,
      householdRuleFired: false,
      householdClusterUsed: null,
    };
  }

  // Earliest touch is from a different (household) cluster
  return {
    winningTouchpoint: earliest,
    householdRuleFired: true,
    householdClusterUsed: earliest.cluster_id,
  };
}
