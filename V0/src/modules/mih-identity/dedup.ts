/**
 * MIH Identity Resolution — Deterministic Dedup (Spec 03 V0)
 *
 * On a new mih.raw_inbox row:
 * - If phone (E.164) already seen within dedup_window_days → merge into existing cluster
 * - Otherwise → create new cluster + identity_node + golden_record
 *
 * Always maintains:
 *   golden_record.first_touch_* = earliest raw_lead in cluster by source_received_at
 *   golden_record.last_touch_*  = latest
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MihDedupDeps,
  MihRawInboxRef,
  MihDedupResult,
  DedupRulesConfig,
} from './types';

const DEFAULT_RULES: DedupRulesConfig = {
  dedup_window_days: 60,
  fuzzy_name_threshold: 0.85,
  fuzzy_enabled: true,
  household_clustering_enabled: true,
  household_window_days: 30,
  manual_review_threshold: 0.70,
};

export async function getMihDedupRules(
  supabase: SupabaseClient,
  orgId: string,
): Promise<DedupRulesConfig> {
  const { data } = await supabase
    .schema('mih')
    .from('dedup_rules_config')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (!data) return DEFAULT_RULES;
  return data as DedupRulesConfig;
}

/**
 * Look up existing identity_node for a phone value within the dedup window.
 * Returns the first matching node (with cluster info via edge) or null.
 */
async function findExistingPhoneNode(
  supabase: SupabaseClient,
  orgId: string,
  phoneE164: string,
  windowCutoff: Date,
): Promise<{ nodeId: string; clusterId: string; goldenRecordId: string } | null> {
  const { data: nodes } = await supabase
    .schema('mih')
    .from('identity_nodes')
    .select('id, observed_at')
    .eq('org_id', orgId)
    .eq('attribute_type', 'phone')
    .eq('attribute_value', phoneE164)
    .gte('observed_at', windowCutoff.toISOString())
    .order('observed_at', { ascending: false })
    .limit(1);

  if (!nodes || nodes.length === 0) return null;

  const nodeId = (nodes[0] as { id: string }).id;

  // Find cluster via identity_edges
  const { data: edges } = await supabase
    .schema('mih')
    .from('identity_edges')
    .select('cluster_id')
    .eq('org_id', orgId)
    .eq('node_id', nodeId)
    .is('reversed_at', null)
    .limit(1);

  if (!edges || edges.length === 0) return null;

  const clusterId = (edges[0] as { cluster_id: string }).cluster_id;

  // Get golden record id
  const { data: golden } = await supabase
    .schema('mih')
    .from('golden_records')
    .select('id')
    .eq('org_id', orgId)
    .eq('cluster_id', clusterId)
    .single();

  if (!golden) return null;

  return { nodeId, clusterId, goldenRecordId: (golden as { id: string }).id };
}

/**
 * Main dedup entry point.
 * Called after a raw_inbox row has been inserted.
 */
export async function resolveMihDedup(
  rawInbox: MihRawInboxRef,
  deps: MihDedupDeps,
): Promise<MihDedupResult> {
  const { supabaseAdmin } = deps;
  const now = deps.now?.() ?? new Date();
  const orgId = rawInbox.org_id;

  const rules = await getMihDedupRules(supabaseAdmin, orgId);
  const windowMs = rules.dedup_window_days * 24 * 60 * 60 * 1000;
  const windowCutoff = new Date(now.getTime() - windowMs);

  const existing = await findExistingPhoneNode(
    supabaseAdmin,
    orgId,
    rawInbox.phone_e164,
    windowCutoff,
  );

  if (existing) {
    // --- Merge into existing cluster ---
    const { clusterId, goldenRecordId } = existing;

    // Insert new identity_node for this raw_inbox
    const { data: newNode } = await supabaseAdmin
      .schema('mih')
      .from('identity_nodes')
      .insert({
        org_id: orgId,
        raw_lead_id: rawInbox.id,
        attribute_type: 'phone',
        attribute_value: rawInbox.phone_e164,
        attribute_value_raw: rawInbox.phone_e164,
        confidence: 1.0,
        observed_at: rawInbox.source_received_at ?? now.toISOString(),
      })
      .select('id')
      .single();

    const newNodeId = (newNode as { id: string } | null)?.id;

    if (newNodeId) {
      // Link new node to cluster
      await supabaseAdmin
        .schema('mih')
        .from('identity_edges')
        .insert({
          org_id: orgId,
          cluster_id: clusterId,
          node_id: newNodeId,
          edge_type: 'deterministic',
          confidence: 1.0,
          rule_applied: 'exact_phone_match',
        });
    }

    // Update cluster stats
    const { data: clusterData } = await supabaseAdmin
      .schema('mih')
      .from('identity_clusters')
      .select('raw_lead_count, source_count')
      .eq('id', clusterId)
      .single();

    if (clusterData) {
      const existing_cluster = clusterData as { raw_lead_count: number; source_count: number };
      await supabaseAdmin
        .schema('mih')
        .from('identity_clusters')
        .update({
          raw_lead_count: existing_cluster.raw_lead_count + 1,
          last_activity_at: now.toISOString(),
        })
        .eq('id', clusterId);
    }

    // Update golden_record first_touch / last_touch
    const { data: goldenData } = await supabaseAdmin
      .schema('mih')
      .from('golden_records')
      .select('first_touch_at, last_touch_at')
      .eq('id', goldenRecordId)
      .single();

    if (goldenData) {
      const gr = goldenData as { first_touch_at: string | null; last_touch_at: string | null };
      const incomingAt = rawInbox.source_received_at ?? now.toISOString();

      const updates: Record<string, unknown> = {
        last_touch_raw_lead_id: rawInbox.id,
        last_touch_source_id: rawInbox.source_id ?? null,
        last_touch_at: incomingAt,
        updated_at: now.toISOString(),
      };

      // Only update first_touch if incoming is earlier
      if (!gr.first_touch_at || incomingAt < gr.first_touch_at) {
        updates.first_touch_raw_lead_id = rawInbox.id;
        updates.first_touch_source_id = rawInbox.source_id ?? null;
        updates.first_touch_at = incomingAt;
      }

      // Restore last_touch if incoming is actually earlier than current last_touch
      if (gr.last_touch_at && incomingAt < gr.last_touch_at) {
        delete updates.last_touch_raw_lead_id;
        delete updates.last_touch_source_id;
        delete updates.last_touch_at;
      }

      await supabaseAdmin
        .schema('mih')
        .from('golden_records')
        .update(updates)
        .eq('id', goldenRecordId);
    }

    // Emit event
    await deps.emitClusterMerged?.(clusterId, orgId, rawInbox.id);

    // Write link_event
    await supabaseAdmin
      .schema('mih')
      .from('link_events')
      .insert({
        org_id: orgId,
        event_type: 'merge',
        cluster_id: clusterId,
        affected_clusters: [clusterId],
        rule_applied: 'exact_phone_match',
        confidence: 1.0,
        triggered_by: 'system',
        details: { raw_inbox_id: rawInbox.id, phone: rawInbox.phone_e164 },
        occurred_at: now.toISOString(),
      });

    return { outcome: 'cluster_merged', clusterId, goldenRecordId };
  } else {
    // --- Create new cluster ---
    const observedAt = rawInbox.source_received_at ?? now.toISOString();

    // 1. Create identity_cluster
    const { data: cluster } = await supabaseAdmin
      .schema('mih')
      .from('identity_clusters')
      .insert({
        org_id: orgId,
        cluster_type: 'individual',
        first_seen_at: observedAt,
        last_activity_at: observedAt,
        source_count: 1,
        raw_lead_count: 1,
        state: 'active',
      })
      .select('id')
      .single();

    const clusterId = (cluster as { id: string }).id;

    // 2. Create identity_node
    const { data: node } = await supabaseAdmin
      .schema('mih')
      .from('identity_nodes')
      .insert({
        org_id: orgId,
        raw_lead_id: rawInbox.id,
        attribute_type: 'phone',
        attribute_value: rawInbox.phone_e164,
        attribute_value_raw: rawInbox.phone_e164,
        confidence: 1.0,
        observed_at: observedAt,
      })
      .select('id')
      .single();

    const nodeId = (node as { id: string }).id;

    // 3. Update cluster primary_node_id
    await supabaseAdmin
      .schema('mih')
      .from('identity_clusters')
      .update({ primary_node_id: nodeId })
      .eq('id', clusterId);

    // 4. Create identity_edge
    await supabaseAdmin
      .schema('mih')
      .from('identity_edges')
      .insert({
        org_id: orgId,
        cluster_id: clusterId,
        node_id: nodeId,
        edge_type: 'deterministic',
        confidence: 1.0,
        rule_applied: 'first_seen',
      });

    // 5. Create golden_record
    const { data: golden } = await supabaseAdmin
      .schema('mih')
      .from('golden_records')
      .insert({
        org_id: orgId,
        cluster_id: clusterId,
        primary_phone: rawInbox.phone_e164,
        alt_phones: [],
        primary_email: rawInbox.email ?? null,
        alt_emails: [],
        primary_name: rawInbox.name ?? null,
        alt_names: [],
        first_touch_raw_lead_id: rawInbox.id,
        first_touch_source_id: rawInbox.source_id ?? null,
        first_touch_at: observedAt,
        last_touch_raw_lead_id: rawInbox.id,
        last_touch_source_id: rawInbox.source_id ?? null,
        last_touch_at: observedAt,
        updated_at: now.toISOString(),
      })
      .select('id')
      .single();

    const goldenRecordId = (golden as { id: string }).id;

    // 6. Emit event
    await deps.emitClusterCreated?.(clusterId, orgId);

    // 7. Write link_event
    await supabaseAdmin
      .schema('mih')
      .from('link_events')
      .insert({
        org_id: orgId,
        event_type: 'merge',
        cluster_id: clusterId,
        affected_clusters: [clusterId],
        rule_applied: 'first_seen',
        confidence: 1.0,
        triggered_by: 'system',
        details: { raw_inbox_id: rawInbox.id, phone: rawInbox.phone_e164 },
        occurred_at: now.toISOString(),
      });

    return { outcome: 'cluster_created', clusterId, goldenRecordId };
  }
}
