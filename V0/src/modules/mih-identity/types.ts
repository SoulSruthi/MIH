/**
 * Types for MIH Identity Resolution (Spec 03 V0)
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type MihDedupDeps = {
  supabaseAdmin: SupabaseClient;
  /** Override current time for testing */
  now?: () => Date;
  /** Emit identity events */
  emitClusterCreated?: (clusterId: string, orgId: string) => Promise<void>;
  emitClusterMerged?: (clusterId: string, orgId: string, rawInboxId: string) => Promise<void>;
};

export type MihRawInboxRef = {
  id: string;
  org_id: string;
  phone_e164: string;
  email?: string | null;
  name?: string | null;
  source_id?: string | null;
  source_received_at?: string | null;
};

export type MihDedupResult =
  | { outcome: 'cluster_created'; clusterId: string; goldenRecordId: string }
  | { outcome: 'cluster_merged'; clusterId: string; goldenRecordId: string };

export type DedupRulesConfig = {
  dedup_window_days: number;
  fuzzy_name_threshold: number;
  fuzzy_enabled: boolean;
  household_clustering_enabled: boolean;
  household_window_days: number;
  manual_review_threshold: number;
};

export type IdentityNode = {
  id: string;
  org_id: string;
  raw_lead_id: string | null;
  attribute_type: 'phone' | 'email' | 'name' | 'alt_phone';
  attribute_value: string;
  attribute_value_raw: string | null;
  confidence: number;
  observed_at: string;
};

export type IdentityCluster = {
  id: string;
  org_id: string;
  cluster_type: 'individual' | 'household' | 'suspect';
  primary_node_id: string | null;
  first_seen_at: string;
  last_activity_at: string;
  source_count: number;
  raw_lead_count: number;
  state: 'active' | 'merged_into' | 'split';
  merged_into_id: string | null;
  created_at: string;
};

export type GoldenRecord = {
  id: string;
  org_id: string;
  cluster_id: string;
  primary_phone: string;
  alt_phones: string[];
  primary_email: string | null;
  alt_emails: string[];
  primary_name: string | null;
  alt_names: string[];
  first_touch_raw_lead_id: string | null;
  first_touch_source_id: string | null;
  first_touch_at: string | null;
  last_touch_raw_lead_id: string | null;
  last_touch_source_id: string | null;
  last_touch_at: string | null;
  updated_at: string;
};
