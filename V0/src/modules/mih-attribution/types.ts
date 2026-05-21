/**
 * Types for MIH Attribution Engine (Spec 04 Phase 2)
 *
 * Implements first-touch attribution as the primary model,
 * replacing the previous last-touch approach.
 */

export type AttributionModelCode = 'first_touch_v1' | 'last_touch_v1' | 'time_decay_v1';

export type ConversionEventCode =
  | 'lead_received'
  | 'contacted'
  | 'qualified'
  | 'site_visit_scheduled'
  | 'site_visit_completed'
  | 'deal_created'
  | 'deal_won'
  | 'deal_lost';

export type AttributionConfig = {
  conversion_window_days: number;        // default 60
  household_rule_enabled: boolean;
  cp_claim_block_rule_enabled: boolean;
  cp_claim_grace_minutes: number;        // default 0
};

export type Touchpoint = {
  raw_lead_id: string;
  source_id: string | null;
  source_type: 'online' | 'cp' | 'referral' | 'walk_in' | 'unknown';
  source_received_at: string;           // ISO timestamp
  cluster_id: string;                   // which cluster owns this touchpoint
};

export type AttributionDecision = {
  winning_raw_lead_id: string | null;
  winning_source_id: string | null;
  winning_touch_at: string | null;
  weight: number;
  reason: string;
  rule_applied: string;
  computation_inputs: {
    touchpoints_considered: Touchpoint[];
    window_cutoff: string;
    cp_block_fired: boolean;
    household_rule_fired: boolean;
    household_clusters_checked?: string[];
  };
};

export type AttributionEngineInput = {
  orgId: string;
  conversionEventId: string;
  convertingClusterId: string;
  conversionOccurredAt: string;
  config: AttributionConfig;
  modelCode: AttributionModelCode;
};

export type AttributionEngineResult = {
  decision: AttributionDecision;
  modelCode: AttributionModelCode;
  dispute?: {
    reason: 'cp_claim_blocked' | 'household_override';
    context: Record<string, unknown>;
  };
};
