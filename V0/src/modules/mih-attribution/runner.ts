/**
 * MIH Attribution Runner (Spec 04 V1 — DB-aware layer)
 *
 * DB-aware wrapper around the pure attribution engine.
 * Fetches touchpoints, runs the engine, persists attribution_results,
 * writes disputes, and updates project_source_history.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Touchpoint, AttributionConfig } from './types';
import { computeFirstTouchAttribution } from './engine';
import { computeLastTouchDecision, computeTimeDecayDecision } from './comparison-models';
import { createItem } from '@/modules/reconciliation/queue';

const DEFAULT_CONFIG: AttributionConfig = {
  conversion_window_days: 60,
  household_rule_enabled: true,
  cp_claim_block_rule_enabled: true,
  cp_claim_grace_minutes: 0,
};

function inferSourceType(taxonomyPath: string | null): Touchpoint['source_type'] {
  if (!taxonomyPath) return 'unknown';
  const p = taxonomyPath.toLowerCase();
  if (p.includes('cp') || p.includes('channel_partner')) return 'cp';
  if (p.includes('referral')) return 'referral';
  if (p.includes('walk_in') || p.includes('walkin')) return 'walk_in';
  return 'online';
}

export type AttributionRunArgs = {
  conversionEventId: string;
  clusterId: string;
  orgId: string;
  conversionOccurredAt: string;
  projectId: string | null;
  eventCode: string;
  dealValuePaise?: number | null;
};

/**
 * Executes the first-touch attribution engine for a conversion event
 * and persists the result to the DB. Idempotent: supersedes any prior
 * result for the same (conversion_event, model) pair.
 */
export async function runAttributionForConversionEvent(
  args: AttributionRunArgs,
  supabase: SupabaseClient,
): Promise<void> {
  // 1. Load attribution config
  const { data: configRow } = await supabase
    .schema('mih')
    .from('attribution_config')
    .select('conversion_window_days,household_rule_enabled,cp_claim_block_rule_enabled,cp_claim_grace_minutes')
    .eq('org_id', args.orgId)
    .single();

  const config: AttributionConfig = configRow
    ? {
        conversion_window_days: (configRow as Record<string, unknown>).conversion_window_days as number ?? DEFAULT_CONFIG.conversion_window_days,
        household_rule_enabled: (configRow as Record<string, unknown>).household_rule_enabled as boolean ?? DEFAULT_CONFIG.household_rule_enabled,
        cp_claim_block_rule_enabled: (configRow as Record<string, unknown>).cp_claim_block_rule_enabled as boolean ?? DEFAULT_CONFIG.cp_claim_block_rule_enabled,
        cp_claim_grace_minutes: (configRow as Record<string, unknown>).cp_claim_grace_minutes as number ?? DEFAULT_CONFIG.cp_claim_grace_minutes,
      }
    : DEFAULT_CONFIG;

  // 2. Get or create the operational attribution model
  const { data: modelRow } = await supabase
    .schema('mih')
    .from('attribution_models')
    .select('id')
    .eq('org_id', args.orgId)
    .eq('model_code', 'first_touch_v1')
    .eq('is_operational', true)
    .single();

  let modelId: string;
  if (modelRow) {
    modelId = (modelRow as Record<string, string>).id;
  } else {
    const { data: created } = await supabase
      .schema('mih')
      .from('attribution_models')
      .insert({
        org_id: args.orgId,
        model_code: 'first_touch_v1',
        display_name: 'First Touch',
        description: 'Credits the first touchpoint within the conversion window.',
        is_operational: true,
        is_comparison: false,
      })
      .select('id')
      .single();
    modelId = (created as Record<string, string>).id;
  }

  // 3. Fetch all touchpoints for this cluster (3-hop: edges → nodes → raw_inbox)
  const touchpoints = await fetchClusterTouchpoints(supabase, args.orgId, args.clusterId);

  // 4. Fetch household cluster IDs from golden_record.household_members
  const householdClusterIds = await fetchHouseholdClusterIds(supabase, args.orgId, args.clusterId);

  // Fetch touchpoints for household clusters too
  for (const hcId of householdClusterIds) {
    const hcTouchpoints = await fetchClusterTouchpoints(supabase, args.orgId, hcId);
    touchpoints.push(...hcTouchpoints);
  }

  // 5. Run the pure attribution engine
  const engineResult = computeFirstTouchAttribution(
    {
      orgId: args.orgId,
      conversionEventId: args.conversionEventId,
      convertingClusterId: args.clusterId,
      conversionOccurredAt: args.conversionOccurredAt,
      config,
      modelCode: 'first_touch_v1',
    },
    touchpoints,
    householdClusterIds,
  );

  // 6. Mark existing (non-superseded) result as superseded after we insert the new one
  const { data: existingResult } = await supabase
    .schema('mih')
    .from('attribution_results')
    .select('id')
    .eq('org_id', args.orgId)
    .eq('conversion_event_id', args.conversionEventId)
    .eq('model_id', modelId)
    .is('superseded_by_id', null)
    .single();

  // 7. Insert new attribution_result
  const { data: newResult } = await supabase
    .schema('mih')
    .from('attribution_results')
    .insert({
      org_id: args.orgId,
      conversion_event_id: args.conversionEventId,
      model_id: modelId,
      cluster_id: args.clusterId,
      winning_source_id: engineResult.decision.winning_source_id,
      winning_raw_lead_id: engineResult.decision.winning_raw_lead_id,
      winning_touch_at: engineResult.decision.winning_touch_at,
      weight: engineResult.decision.weight,
      reason: engineResult.decision.reason,
      rule_applied: engineResult.decision.rule_applied,
      computation_inputs: engineResult.decision.computation_inputs,
    })
    .select('id')
    .single();

  const newResultId = (newResult as Record<string, string> | null)?.id;

  // Mark old result superseded
  if (existingResult && newResultId) {
    await supabase
      .schema('mih')
      .from('attribution_results')
      .update({ superseded_by_id: newResultId })
      .eq('id', (existingResult as Record<string, string>).id);
  }

  // 8. Write dispute if needed
  if (engineResult.dispute && newResultId) {
    await supabase
      .schema('mih')
      .from('disputed_attributions')
      .insert({
        org_id: args.orgId,
        attribution_result_id: newResultId,
        conversion_event_id: args.conversionEventId,
        dispute_reason: engineResult.dispute.reason,
        dispute_context: engineResult.dispute.context,
        state: 'open',
      });

    // Auto-create reconciliation queue item for disputed CP credit
    try {
      await createItem({
        org_id: args.orgId,
        item_type: 'disputed_cp_credit',
        severity: 'normal',
        ...(args.dealValuePaise != null ? { monetary_impact: args.dealValuePaise } : {}),
        cluster_id: args.clusterId,
        origin_event_id: args.conversionEventId,
        context: {
          attribution_result_id: newResultId,
          dispute_reason: engineResult.dispute.reason,
          dispute_context: engineResult.dispute.context,
        },
      });
    } catch (_err) {
      // Non-fatal: queue item creation failure must not block attribution
    }
  }

  // 9. Update project_source_history if project_id + winning source are known
  if (args.projectId && engineResult.decision.winning_source_id && newResultId) {
    await upsertProjectSourceHistory(supabase, {
      orgId: args.orgId,
      projectId: args.projectId,
      sourceId: engineResult.decision.winning_source_id,
      conversionOccurredAt: args.conversionOccurredAt,
      eventCode: args.eventCode,
      dealValuePaise: args.dealValuePaise ?? 0,
      touchpointCount: touchpoints.length,
    });
  }

  // 10. Compute and store comparison model results (last_touch_v1, time_decay_v1)
  //     Re-use the same in-window touchpoints the first-touch engine already computed.
  //     We re-derive them here for clarity (filter + sort) using the same config.
  const windowMs = config.conversion_window_days * 24 * 60 * 60 * 1000;
  const conversionMs = new Date(args.conversionOccurredAt).getTime();
  const inWindowTouchpoints = touchpoints
    .filter((tp) => {
      const tpMs = new Date(tp.source_received_at).getTime();
      return tpMs >= conversionMs - windowMs && tpMs <= conversionMs;
    })
    .sort((a, b) => a.source_received_at.localeCompare(b.source_received_at));

  const comparisonModels = [
    {
      modelCode: 'last_touch_v1' as const,
      displayName: 'Last Touch',
      description: 'Credits the last touchpoint within the conversion window.',
      computeDecision: () =>
        computeLastTouchDecision(inWindowTouchpoints, args.conversionOccurredAt, config.conversion_window_days),
    },
    {
      modelCode: 'time_decay_v1' as const,
      displayName: 'Time Decay',
      description: 'Credits the touchpoint with highest time-decay weight (lambda=0.1).',
      computeDecision: () =>
        computeTimeDecayDecision(inWindowTouchpoints, args.conversionOccurredAt, config.conversion_window_days),
    },
  ] as const;

  for (const cm of comparisonModels) {
    // Get or create comparison model row
    const { data: cmModelRow } = await supabase
      .schema('mih')
      .from('attribution_models')
      .select('id')
      .eq('org_id', args.orgId)
      .eq('model_code', cm.modelCode)
      .eq('is_comparison', true)
      .single();

    let cmModelId: string;
    if (cmModelRow) {
      cmModelId = (cmModelRow as Record<string, string>).id;
    } else {
      const { data: cmCreated } = await supabase
        .schema('mih')
        .from('attribution_models')
        .insert({
          org_id: args.orgId,
          model_code: cm.modelCode,
          display_name: cm.displayName,
          description: cm.description,
          is_operational: false,
          is_comparison: true,
        })
        .select('id')
        .single();
      cmModelId = (cmCreated as Record<string, string>).id;
    }

    const cmDecision = cm.computeDecision();

    // Find existing non-superseded result for this comparison model
    const { data: existingCmResult } = await supabase
      .schema('mih')
      .from('attribution_results')
      .select('id')
      .eq('org_id', args.orgId)
      .eq('conversion_event_id', args.conversionEventId)
      .eq('model_id', cmModelId)
      .is('superseded_by_id', null)
      .single();

    // Insert new comparison result
    const { data: newCmResult } = await supabase
      .schema('mih')
      .from('attribution_results')
      .insert({
        org_id: args.orgId,
        conversion_event_id: args.conversionEventId,
        model_id: cmModelId,
        cluster_id: args.clusterId,
        winning_source_id: cmDecision.winning_source_id,
        winning_raw_lead_id: cmDecision.winning_raw_lead_id,
        winning_touch_at: cmDecision.winning_touch_at,
        weight: cmDecision.weight,
        reason: cmDecision.reason,
        rule_applied: cmDecision.rule_applied,
        computation_inputs: cmDecision.computation_inputs,
      })
      .select('id')
      .single();

    const newCmResultId = (newCmResult as Record<string, string> | null)?.id;

    // Supersede old comparison result
    if (existingCmResult && newCmResultId) {
      await supabase
        .schema('mih')
        .from('attribution_results')
        .update({ superseded_by_id: newCmResultId })
        .eq('id', (existingCmResult as Record<string, string>).id);
    }
    // No disputes for comparison models — disputes are operational-model only
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchClusterTouchpoints(
  supabase: SupabaseClient,
  orgId: string,
  clusterId: string,
): Promise<Touchpoint[]> {
  // edges → node_ids
  const { data: edges } = await supabase
    .schema('mih')
    .from('identity_edges')
    .select('node_id')
    .eq('org_id', orgId)
    .eq('cluster_id', clusterId)
    .is('reversed_at', null);

  const nodeIds = ((edges ?? []) as Array<{ node_id: string }>).map((e) => e.node_id);
  if (nodeIds.length === 0) return [];

  // nodes → raw_lead_ids
  const { data: nodes } = await supabase
    .schema('mih')
    .from('identity_nodes')
    .select('raw_lead_id')
    .eq('org_id', orgId)
    .in('id', nodeIds)
    .not('raw_lead_id', 'is', null);

  const rawLeadIds = [
    ...new Set(
      ((nodes ?? []) as Array<{ raw_lead_id: string }>)
        .map((n) => n.raw_lead_id)
        .filter(Boolean),
    ),
  ];
  if (rawLeadIds.length === 0) return [];

  // raw_inbox rows
  const { data: rawLeads } = await supabase
    .schema('mih')
    .from('raw_inbox')
    .select('id, source_id, source_received_at')
    .eq('org_id', orgId)
    .in('id', rawLeadIds);

  const rows = (rawLeads ?? []) as Array<{
    id: string;
    source_id: string | null;
    source_received_at: string | null;
  }>;

  // Batch-fetch source taxonomy paths for type inference
  const sourceIds = [...new Set(rows.map((r) => r.source_id).filter(Boolean))] as string[];
  const sourceTypeMap = new Map<string, Touchpoint['source_type']>();

  if (sourceIds.length > 0) {
    const { data: sources } = await supabase
      .schema('mih')
      .from('sources')
      .select('id, taxonomy_path')
      .in('id', sourceIds);

    ((sources ?? []) as Array<{ id: string; taxonomy_path: string | null }>).forEach((s) => {
      sourceTypeMap.set(s.id, inferSourceType(s.taxonomy_path));
    });
  }

  return rows.map((r) => ({
    raw_lead_id: r.id,
    source_id: r.source_id,
    source_type: r.source_id ? (sourceTypeMap.get(r.source_id) ?? 'unknown') : 'unknown',
    source_received_at: r.source_received_at ?? new Date().toISOString(),
    cluster_id: clusterId,
  }));
}

async function fetchHouseholdClusterIds(
  supabase: SupabaseClient,
  orgId: string,
  clusterId: string,
): Promise<string[]> {
  const { data: golden } = await supabase
    .schema('mih')
    .from('golden_records')
    .select('household_members')
    .eq('org_id', orgId)
    .eq('cluster_id', clusterId)
    .single();

  if (!golden) return [];
  const members = (golden as Record<string, unknown>).household_members;
  if (!Array.isArray(members)) return [];
  return (members as string[]).filter((id) => id !== clusterId);
}

async function upsertProjectSourceHistory(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    projectId: string;
    sourceId: string;
    conversionOccurredAt: string;
    eventCode: string;
    dealValuePaise: number;
    touchpointCount: number;
  },
): Promise<void> {
  const d = new Date(args.conversionOccurredAt);
  // Indian FY: April–March. Month < 3 (Jan–Mar) belongs to previous FY year.
  const fyYear = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear();

  const { data: existing } = await supabase
    .schema('mih')
    .from('project_source_history')
    .select('id, bookings_count, bookings_value, leads_count')
    .eq('org_id', args.orgId)
    .eq('project_id', args.projectId)
    .eq('source_id', args.sourceId)
    .eq('fy_year', fyYear)
    .eq('event_code', args.eventCode)
    .single();

  if (existing) {
    const curr = existing as {
      id: string;
      bookings_count: number;
      bookings_value: number;
      leads_count: number;
    };
    await supabase
      .schema('mih')
      .from('project_source_history')
      .update({
        bookings_count: curr.bookings_count + 1,
        bookings_value: curr.bookings_value + args.dealValuePaise,
        leads_count: curr.leads_count + args.touchpointCount,
        last_refreshed_at: new Date().toISOString(),
      })
      .eq('id', curr.id);
  } else {
    await supabase
      .schema('mih')
      .from('project_source_history')
      .insert({
        org_id: args.orgId,
        project_id: args.projectId,
        source_id: args.sourceId,
        fy_year: fyYear,
        event_code: args.eventCode,
        bookings_count: 1,
        bookings_value: args.dealValuePaise,
        leads_count: args.touchpointCount,
        last_refreshed_at: new Date().toISOString(),
      });
  }
}
