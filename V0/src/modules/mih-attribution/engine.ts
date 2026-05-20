/**
 * MIH Attribution Engine — First-Touch Model (Spec 04 Phase 2)
 *
 * Pure function: no DB calls. All data is passed in.
 * Rules applied in order:
 *   1. Filter touchpoints within conversion_window_days
 *   2. Sort by source_received_at ASC (earliest first)
 *   3. Apply CP claim-block rule (if enabled)
 *   4. Apply household first-member rule (if enabled)
 *   5. Pick winning touchpoint
 *   6. Return AttributionEngineResult
 */
import type {
  AttributionEngineInput,
  AttributionEngineResult,
  AttributionDecision,
  Touchpoint,
} from './types.js';
import { applyCpClaimBlock } from './cp-claim-block.js';
import { applyHouseholdRule } from './household-rule.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortBySourceReceivedAtAsc(touchpoints: Touchpoint[]): Touchpoint[] {
  return [...touchpoints].sort((a, b) =>
    a.source_received_at.localeCompare(b.source_received_at),
  );
}

function filterWithinWindow(
  touchpoints: Touchpoint[],
  conversionOccurredAt: string,
  windowDays: number,
): Touchpoint[] {
  const conversionMs = new Date(conversionOccurredAt).getTime();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const cutoffMs = conversionMs - windowMs;

  return touchpoints.filter((tp) => {
    const tpMs = new Date(tp.source_received_at).getTime();
    return tpMs >= cutoffMs && tpMs <= conversionMs;
  });
}

function buildWindowCutoff(conversionOccurredAt: string, windowDays: number): string {
  const conversionMs = new Date(conversionOccurredAt).getTime();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return new Date(conversionMs - windowMs).toISOString();
}

function buildNullDecision(
  windowCutoff: string,
  touchpointsConsidered: Touchpoint[],
  householdClustersChecked: string[],
): AttributionDecision {
  return {
    winning_raw_lead_id: null,
    winning_source_id: null,
    winning_touch_at: null,
    weight: 0,
    reason: 'no_touchpoints_in_window',
    rule_applied: 'first_touch_v1',
    computation_inputs: {
      touchpoints_considered: touchpointsConsidered,
      window_cutoff: windowCutoff,
      cp_block_fired: false,
      household_rule_fired: false,
      household_clusters_checked: householdClustersChecked,
    },
  };
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

/**
 * Computes first-touch attribution for a conversion event.
 *
 * @param input           - Engine configuration: org, conversion event, config
 * @param touchpoints     - All raw touchpoints for the converting cluster
 * @param householdClusterIds - IDs of other clusters in the same household
 *                            (caller must also supply their touchpoints in `touchpoints`)
 */
export function computeFirstTouchAttribution(
  input: AttributionEngineInput,
  touchpoints: Touchpoint[],
  householdClusterIds: string[],
): AttributionEngineResult {
  const { config, modelCode, conversionOccurredAt, convertingClusterId } = input;

  const windowCutoff = buildWindowCutoff(conversionOccurredAt, config.conversion_window_days);

  // Step 1: Filter touchpoints within conversion window
  const inWindow = filterWithinWindow(
    touchpoints,
    conversionOccurredAt,
    config.conversion_window_days,
  );

  if (inWindow.length === 0) {
    return {
      decision: buildNullDecision(windowCutoff, [], householdClusterIds),
      modelCode,
    };
  }

  // Step 2: Sort ASC (earliest first)
  const sorted = sortBySourceReceivedAtAsc(inWindow);

  let winner: Touchpoint = sorted[0];
  let cpBlockFired = false;
  let householdRuleFired = false;
  let householdClusterUsed: string | null = null;
  let disputeReason: 'cp_claim_blocked' | 'household_override' | undefined;
  const disputeContext: Record<string, unknown> = {};

  // Step 3: CP claim-block rule
  if (config.cp_claim_block_rule_enabled) {
    const cpResult = applyCpClaimBlock(sorted, config.cp_claim_grace_minutes);
    if (cpResult.blocked) {
      cpBlockFired = true;
      winner = cpResult.winningTouchpoint;
      disputeReason = 'cp_claim_blocked';
      disputeContext.blocked_touchpoint = cpResult.blockedTouchpoint;
      disputeContext.winning_touchpoint = cpResult.winningTouchpoint;
    } else {
      winner = cpResult.winningTouchpoint;
    }
  }

  // Step 4: Household first-member rule
  // Build the combined sorted touchpoint list (already sorted; if CP rule ran, we
  // re-sort all in-window touchpoints including household ones for the household check)
  if (config.household_rule_enabled && householdClusterIds.length > 0) {
    // allTouchpoints = inWindow sorted (includes both converting cluster + household clusters
    // since the caller is expected to pass all of them in `touchpoints`)
    const householdResult = applyHouseholdRule(convertingClusterId, sorted);
    if (householdResult.householdRuleFired) {
      householdRuleFired = true;
      householdClusterUsed = householdResult.householdClusterUsed;
      winner = householdResult.winningTouchpoint;

      // Household override takes precedence over CP block dispute
      if (disputeReason !== 'cp_claim_blocked') {
        disputeReason = 'household_override';
      }
      disputeContext.household_cluster_used = householdClusterUsed;
      disputeContext.converting_cluster_id = convertingClusterId;
    }
  }

  const decision: AttributionDecision = {
    winning_raw_lead_id: winner.raw_lead_id,
    winning_source_id: winner.source_id,
    winning_touch_at: winner.source_received_at,
    weight: 1,
    reason: cpBlockFired
      ? 'cp_claim_blocked'
      : householdRuleFired
        ? 'household_first_member'
        : 'first_touch',
    rule_applied: modelCode,
    computation_inputs: {
      touchpoints_considered: sorted,
      window_cutoff: windowCutoff,
      cp_block_fired: cpBlockFired,
      household_rule_fired: householdRuleFired,
      household_clusters_checked: householdClusterIds,
    },
  };

  const result: AttributionEngineResult = { decision, modelCode };

  if (disputeReason) {
    result.dispute = { reason: disputeReason, context: disputeContext };
  }

  return result;
}
