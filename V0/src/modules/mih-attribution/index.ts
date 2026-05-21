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
} from './types.js';

export { computeFirstTouchAttribution } from './engine.js';
export { applyCpClaimBlock } from './cp-claim-block.js';
export type { CpClaimBlockResult } from './cp-claim-block.js';
export { applyHouseholdRule } from './household-rule.js';
export type { HouseholdRuleResult } from './household-rule.js';
export { runAttributionForConversionEvent } from './runner.js';
export type { AttributionRunArgs } from './runner.js';
