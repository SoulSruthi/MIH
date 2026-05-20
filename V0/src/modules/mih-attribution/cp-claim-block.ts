/**
 * CP Claim Block Rule (Spec 04 Phase 2)
 *
 * Prevents a Channel Partner (CP) from claiming attribution credit when
 * a non-CP source already had the first touch within the conversion window.
 *
 * Input touchpoints must be pre-sorted by source_received_at ASC.
 */
import type { Touchpoint } from './types.js';

export type CpClaimBlockResult = {
  blockedTouchpoint: Touchpoint | null;
  winningTouchpoint: Touchpoint;
  blocked: boolean;
};

/**
 * Applies the CP claim block rule to a sorted (ASC) list of touchpoints.
 *
 * Logic:
 * - If the first touchpoint is from a CP source:
 *     - Look for any non-CP touchpoint in the list
 *     - If one exists: compute the gap between CP and non-CP touch
 *     - If gap > gracePeriodMinutes: block CP, return non-CP as winner
 *     - Else: CP wins (within grace period)
 * - If first touchpoint is non-CP: return it as winner, not blocked
 */
export function applyCpClaimBlock(
  touchpoints: Touchpoint[],
  gracePeriodMinutes: number,
): CpClaimBlockResult {
  if (touchpoints.length === 0) {
    throw new Error('applyCpClaimBlock: touchpoints array must not be empty');
  }

  const first = touchpoints[0];

  // If the first touch is not CP, no blocking needed
  if (first.source_type !== 'cp') {
    return {
      blockedTouchpoint: null,
      winningTouchpoint: first,
      blocked: false,
    };
  }

  // First touch is CP — look for the earliest non-CP touchpoint
  const nonCpTouchpoint = touchpoints.find((tp) => tp.source_type !== 'cp') ?? null;

  if (nonCpTouchpoint === null) {
    // All touchpoints are CP — CP wins, nothing to block
    return {
      blockedTouchpoint: null,
      winningTouchpoint: first,
      blocked: false,
    };
  }

  // Compute gap between non-CP and CP touches (both ISO strings)
  const cpAt = new Date(first.source_received_at).getTime();
  const nonCpAt = new Date(nonCpTouchpoint.source_received_at).getTime();
  const gapMs = Math.abs(cpAt - nonCpAt);
  const gapMinutes = gapMs / (1000 * 60);

  if (gapMinutes > gracePeriodMinutes) {
    // CP blocked: non-CP wins
    return {
      blockedTouchpoint: first,
      winningTouchpoint: nonCpTouchpoint,
      blocked: true,
    };
  }

  // Within grace period — CP wins
  return {
    blockedTouchpoint: null,
    winningTouchpoint: first,
    blocked: false,
  };
}
