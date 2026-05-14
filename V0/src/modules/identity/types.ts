import type { SupabaseClient } from '@supabase/supabase-js';

export type DedupStatus = 'pending' | 'unique' | 'duplicate' | 'merged_into_unique';
export type PostWindowBehavior = 'new_lead' | 'merge_existing';
export type DedupeReason = 'within_window' | 'post_window_merge';

export type OrgDedupRules = {
  phone_window_hours: number;
  post_window_behavior: PostWindowBehavior;
};

export type RawLeadRef = {
  id: string;
  phone_e164: string;
  email: string | null;
  name: string;
  source_id: string;
  source_received_at: string;
  // M-007: richer touch / preference context
  source_campaign_id?: string | null;
  source_campaign_name?: string | null;
  source_ad_id?: string | null;
  source_ad_name?: string | null;
  raw_payload?: unknown;
};

export type UniqueLead = {
  id: string;
  primary_name: string;
  known_names: string[];
  last_seen_at: string;
  total_touches: number;
  touch_sources: TouchSource[];
};

export type TouchSource = {
  source_id: string;
  raw_lead_id: string;
  touched_at: string;
  source_campaign_id?: string | null;
  source_ad_id?: string | null;
};

export type DedupOutcome = 'unique' | 'duplicate';

export type DedupResult = {
  outcome: DedupOutcome;
  uniqueLeadId: string;
};

export type DedupDeps = {
  supabaseAdmin: SupabaseClient;
  orgSlug: string;
  emitDedupDecided?: (params: {
    unique_lead_id: string;
    dedup_status: DedupStatus;
    org_id: string;
  }) => Promise<void>;
  requestId?: string;
  now?: () => Date;
};

export type CreateUniqueLeadInput = {
  organization_id: string;
  identity_cluster_id: string;
  primary_phone_e164: string;
  primary_email: string | null;
  primary_name: string;
  first_seen_at: string;
  last_seen_at: string;
  primary_source_id: string;
  total_touches: number;
  touch_sources: TouchSource[];
  known_names: string[];
  // M-007 additions
  crm_external_id: string;
  crm_handoff_status: 'pending';
  preference_bhk?: string | null;
  preference_budget_band?: string | null;
  preference_location?: string | null;
};

export type AuditLogEntry = {
  organization_id: string;
  actor_type: string;
  action: string;
  table_name: string;
  record_id: string;
  request_id: string;
  after_state: Record<string, unknown>;
};
