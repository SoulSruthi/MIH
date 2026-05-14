import type { SupabaseClient } from '@supabase/supabase-js';

export type DedupStatus = 'pending' | 'unique' | 'duplicate' | 'merged_into_unique';
export type PostWindowBehavior = 'new_lead' | 'merge_existing';

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
};

export type UniqueLead = {
  id: string;
  last_seen_at: string;
  total_touches: number;
  touch_sources: TouchSource[];
};

export type TouchSource = {
  source_id: string;
  raw_lead_id: string;
  seen_at: string;
};

export type DedupOutcome = 'unique' | 'duplicate';

export type DedupResult = {
  outcome: DedupOutcome;
  uniqueLeadId: string;
};

export type DedupDeps = {
  supabaseAdmin: SupabaseClient;
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
