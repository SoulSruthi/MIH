/**
 * MIH Attribution Engine — Public API (Spec 04 Phase 2)
 */
export type {
  AttributionModelCode,
  ConversionEventCode,
  AttributionConfig,
  Touchpoint,
  AttributionDecision,
  AttributionEngineInput,
  AttributionEngineResult,
} from './types';

export { computeFirstTouchAttribution } from './engine';
export { applyCpClaimBlock } from './cp-claim-block';
export type { CpClaimBlockResult } from './cp-claim-block';
export { applyHouseholdRule } from './household-rule';
export type { HouseholdRuleResult } from './household-rule';
export { runAttributionForConversionEvent } from './runner';
export type { AttributionRunArgs } from './runner';
