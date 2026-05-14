import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuditLogEntry, CreateUniqueLeadInput, TouchSource, UniqueLead } from './types.js';

export async function lookupPhoneIdentifier(
  supabaseAdmin: SupabaseClient,
  organizationId: string,
  phoneE164: string,
): Promise<{ clusterId: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('identity_identifiers')
    .select('cluster_id')
    .eq('organization_id', organizationId)
    .eq('identifier_type', 'phone_e164')
    .eq('identifier_value', phoneE164)
    .maybeSingle();

  if (error) throw new Error(`identity_identifiers lookup failed: ${error.message}`);
  if (!data) return null;

  return { clusterId: data.cluster_id as string };
}

export async function getClusterPrimaryLeadId(
  supabaseAdmin: SupabaseClient,
  clusterId: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('identity_clusters')
    .select('primary_unique_lead_id')
    .eq('id', clusterId)
    .maybeSingle();

  if (error) throw new Error(`identity_clusters fetch failed: ${error.message}`);
  return (data?.primary_unique_lead_id as string | null | undefined) ?? null;
}

export async function getUniqueLead(
  supabaseAdmin: SupabaseClient,
  organizationId: string,
  uniqueLeadId: string,
): Promise<UniqueLead | null> {
  const { data, error } = await supabaseAdmin
    .from('unique_leads')
    .select('id, last_seen_at, total_touches, touch_sources')
    .eq('organization_id', organizationId)
    .eq('id', uniqueLeadId)
    .maybeSingle();

  if (error) throw new Error(`unique_leads fetch failed: ${error.message}`);
  if (!data) return null;

  return {
    id: data.id as string,
    last_seen_at: data.last_seen_at as string,
    total_touches: data.total_touches as number,
    touch_sources: (data.touch_sources as TouchSource[]) ?? [],
  };
}

export async function createClusterWithIdentifier(
  supabaseAdmin: SupabaseClient,
  organizationId: string,
  phoneE164: string,
): Promise<{ clusterId: string }> {
  const { data: cluster, error: clusterErr } = await supabaseAdmin
    .from('identity_clusters')
    .insert({ organization_id: organizationId })
    .select('id')
    .single();

  if (clusterErr) throw new Error(`identity_clusters insert failed: ${clusterErr.message}`);

  const { error: identifierErr } = await supabaseAdmin
    .from('identity_identifiers')
    .insert({
      organization_id: organizationId,
      cluster_id: cluster.id,
      identifier_type: 'phone_e164',
      identifier_value: phoneE164,
    });

  if (identifierErr) throw new Error(`identity_identifiers insert failed: ${identifierErr.message}`);

  return { clusterId: cluster.id as string };
}

export async function updateClusterPrimaryLead(
  supabaseAdmin: SupabaseClient,
  clusterId: string,
  uniqueLeadId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('identity_clusters')
    .update({ primary_unique_lead_id: uniqueLeadId })
    .eq('id', clusterId);

  if (error) throw new Error(`identity_clusters update failed: ${error.message}`);
}

export async function createUniqueLead(
  supabaseAdmin: SupabaseClient,
  input: CreateUniqueLeadInput,
): Promise<{ uniqueLeadId: string }> {
  const { data, error } = await supabaseAdmin
    .from('unique_leads')
    .insert(input)
    .select('id')
    .single();

  if (error) throw new Error(`unique_leads insert failed: ${error.message}`);
  return { uniqueLeadId: data.id as string };
}

export async function updateUniqueLeadOnDuplicate(
  supabaseAdmin: SupabaseClient,
  uniqueLeadId: string,
  updates: {
    last_seen_at: string;
    total_touches: number;
    touch_sources: TouchSource[];
  },
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('unique_leads')
    .update(updates)
    .eq('id', uniqueLeadId);

  if (error) throw new Error(`unique_leads update (duplicate) failed: ${error.message}`);
}

export async function updateRawLeadDedup(
  supabaseAdmin: SupabaseClient,
  rawLeadId: string,
  dedupStatus: 'unique' | 'duplicate',
  uniqueLeadId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('raw_leads')
    .update({ dedup_status: dedupStatus, unique_lead_id: uniqueLeadId })
    .eq('id', rawLeadId);

  if (error) throw new Error(`raw_leads dedup update failed: ${error.message}`);
}

export async function writeAuditLog(
  supabaseAdmin: SupabaseClient,
  entry: AuditLogEntry,
): Promise<void> {
  const { error } = await supabaseAdmin.from('audit_log').insert(entry);
  if (error) throw new Error(`audit_log insert failed: ${error.message}`);
}
