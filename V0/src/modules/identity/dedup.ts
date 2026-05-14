import type { DedupDeps, DedupResult, RawLeadRef, TouchSource } from './types.js';
import { getOrgDedupRules } from './rules.js';
import {
  lookupPhoneIdentifier,
  getClusterPrimaryLeadId,
  getUniqueLead,
  createClusterWithIdentifier,
  updateClusterPrimaryLead,
  createUniqueLead,
  updateUniqueLeadOnDuplicate,
  updateRawLeadDedup,
  writeAuditLog,
} from './graph.js';

export async function resolveDedup(
  rawLead: RawLeadRef,
  organizationId: string,
  deps: DedupDeps,
): Promise<DedupResult> {
  const { supabaseAdmin } = deps;
  const now = deps.now?.() ?? new Date();
  const requestId = deps.requestId ?? crypto.randomUUID();

  const rules = await getOrgDedupRules(supabaseAdmin, organizationId);

  const identifier = await lookupPhoneIdentifier(supabaseAdmin, organizationId, rawLead.phone_e164);

  let uniqueLeadId: string;
  let outcome: 'unique' | 'duplicate';

  if (identifier) {
    const primaryLeadId = await getClusterPrimaryLeadId(supabaseAdmin, identifier.clusterId);

    if (primaryLeadId) {
      const existingLead = await getUniqueLead(supabaseAdmin, organizationId, primaryLeadId);

      if (existingLead) {
        const ageMs = now.getTime() - new Date(existingLead.last_seen_at).getTime();
        const windowMs = rules.phone_window_hours * 3_600_000;
        const withinWindow = ageMs <= windowMs;

        if (withinWindow || rules.post_window_behavior === 'merge_existing') {
          outcome = 'duplicate';
          uniqueLeadId = existingLead.id;
          const newTouch: TouchSource = {
            source_id: rawLead.source_id,
            raw_lead_id: rawLead.id,
            seen_at: rawLead.source_received_at,
          };
          await updateUniqueLeadOnDuplicate(supabaseAdmin, existingLead.id, {
            last_seen_at: rawLead.source_received_at,
            total_touches: existingLead.total_touches + 1,
            touch_sources: [...existingLead.touch_sources, newTouch],
          });
        } else {
          // Past window with new_lead behavior → fresh unique_lead under same cluster
          const newLead = await createUniqueLead(supabaseAdmin, buildUniqueLeadInput(rawLead, organizationId, identifier.clusterId));
          uniqueLeadId = newLead.uniqueLeadId;
          outcome = 'unique';
          await updateClusterPrimaryLead(supabaseAdmin, identifier.clusterId, uniqueLeadId);
        }
      } else {
        // Orphaned cluster reference — create fresh unique_lead
        const newLead = await createUniqueLead(supabaseAdmin, buildUniqueLeadInput(rawLead, organizationId, identifier.clusterId));
        uniqueLeadId = newLead.uniqueLeadId;
        outcome = 'unique';
        await updateClusterPrimaryLead(supabaseAdmin, identifier.clusterId, uniqueLeadId);
      }
    } else {
      // Cluster exists but has no primary lead yet — create unique_lead
      const newLead = await createUniqueLead(supabaseAdmin, buildUniqueLeadInput(rawLead, organizationId, identifier.clusterId));
      uniqueLeadId = newLead.uniqueLeadId;
      outcome = 'unique';
      await updateClusterPrimaryLead(supabaseAdmin, identifier.clusterId, uniqueLeadId);
    }
  } else {
    // Phone never seen — create cluster + identifier + unique_lead
    const { clusterId } = await createClusterWithIdentifier(supabaseAdmin, organizationId, rawLead.phone_e164);
    const newLead = await createUniqueLead(supabaseAdmin, buildUniqueLeadInput(rawLead, organizationId, clusterId));
    uniqueLeadId = newLead.uniqueLeadId;
    outcome = 'unique';
    await updateClusterPrimaryLead(supabaseAdmin, clusterId, uniqueLeadId);
  }

  const dedupStatus = outcome === 'unique' ? 'unique' : 'duplicate';

  await updateRawLeadDedup(supabaseAdmin, rawLead.id, dedupStatus, uniqueLeadId);

  await writeAuditLog(supabaseAdmin, {
    organization_id: organizationId,
    actor_type: 'system',
    action: outcome === 'unique' ? 'dedup.unique_confirmed' : 'dedup.duplicate_detected',
    table_name: 'raw_leads',
    record_id: rawLead.id,
    request_id: requestId,
    after_state: { unique_lead_id: uniqueLeadId, dedup_status: dedupStatus },
  });

  await deps.emitDedupDecided?.({
    unique_lead_id: uniqueLeadId,
    dedup_status: dedupStatus,
    org_id: organizationId,
  });

  return { outcome, uniqueLeadId };
}

function buildUniqueLeadInput(
  rawLead: RawLeadRef,
  organizationId: string,
  identityClusterId: string,
) {
  return {
    organization_id: organizationId,
    identity_cluster_id: identityClusterId,
    primary_phone_e164: rawLead.phone_e164,
    primary_email: rawLead.email ?? null,
    primary_name: rawLead.name,
    first_seen_at: rawLead.source_received_at,
    last_seen_at: rawLead.source_received_at,
    primary_source_id: rawLead.source_id,
    total_touches: 1,
    touch_sources: [
      {
        source_id: rawLead.source_id,
        raw_lead_id: rawLead.id,
        seen_at: rawLead.source_received_at,
      },
    ],
  };
}
