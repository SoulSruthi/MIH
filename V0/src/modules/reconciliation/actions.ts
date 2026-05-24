import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { ReconciliationItem } from './types';

type ActionResult = {
  actions_taken: string[];
  errors: string[];
};

type OverrideParams = Record<string, unknown>;

export async function executeResolutionActions(
  item: ReconciliationItem,
  resolution: string,
  actorId: string,
  overrideParams: OverrideParams = {},
): Promise<ActionResult> {
  const result: ActionResult = { actions_taken: [], errors: [] };

  try {
    switch (item.item_type) {
      case 'disputed_cp_credit':
        await handleDisputedCpCredit(item, resolution, overrideParams, result);
        break;
      case 'unmatched_walk_in':
        await handleUnmatchedWalkIn(item, overrideParams, result);
        break;
      case 'manual_call_no_tracking':
        await handleManualCallNoTracking(item, resolution, overrideParams, result);
        break;
      case 'low_conf_identity_merge':
        await handleLowConfMerge(item, resolution, overrideParams, result);
        break;
      default:
        // No automatic downstream action for other types — ops-only resolution
        result.actions_taken.push(`Manual resolution recorded: ${resolution}`);
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
  }

  return result;
}

async function handleDisputedCpCredit(
  item: ReconciliationItem,
  resolution: string,
  params: OverrideParams,
  result: ActionResult,
): Promise<void> {
  if (resolution !== 'override_attribution' && resolution !== 'confirm_cp_credit') return;

  const supabase = getSupabaseAdmin();

  if (resolution === 'override_attribution') {
    const conversionEventId = (params.conversion_event_id ?? item.context.conversion_event_id) as string | undefined;
    const winningSrcId = (params.winning_source_id ?? item.context.cp_source_id) as string | undefined;

    if (conversionEventId && winningSrcId) {
      // Find or create operational model
      const { data: model } = await supabase
        .schema('mih')
        .from('attribution_models')
        .select('id')
        .eq('org_id', item.org_id)
        .eq('model_code', 'first_touch_v1')
        .maybeSingle();

      if (model) {
        // Supersede existing result
        const { data: existing } = await supabase
          .schema('mih')
          .from('attribution_results')
          .select('id')
          .eq('org_id', item.org_id)
          .eq('conversion_event_id', conversionEventId)
          .eq('model_id', model.id)
          .is('superseded_by_id', null)
          .maybeSingle();

        const { data: newResult } = await supabase
          .schema('mih')
          .from('attribution_results')
          .insert({
            org_id: item.org_id,
            conversion_event_id: conversionEventId,
            model_id: model.id,
            cluster_id: item.cluster_id,
            winning_source_id: winningSrcId,
            weight: 1.0,
            reason: 'manual_override',
            rule_applied: 'reconciliation_override',
            computation_inputs: {
              reconciliation_item_id: item.id,
              resolution,
            },
          })
          .select('id')
          .single();

        if (newResult && existing) {
          await supabase
            .schema('mih')
            .from('attribution_results')
            .update({ superseded_by_id: (newResult as Record<string, unknown>).id })
            .eq('id', existing.id);
        }

        result.actions_taken.push('Attribution result overridden — CP source now wins');
      }
    }
  }

  // Create CP commission accrual if cp_id and booking_value provided
  const cpId = (params.cp_id ?? item.context.cp_id) as string | undefined;
  const bookingValue = (params.booking_value ?? item.context.booking_value) as number | undefined;

  if ((resolution === 'override_attribution' || resolution === 'confirm_cp_credit') && cpId && bookingValue) {
    const { error: accrualErr } = await supabase
      .schema('mih')
      .from('cp_commission_accruals')
      .insert({
        org_id: item.org_id,
        cp_id: cpId,
        booking_value: bookingValue,
        commission_pct: (params.commission_pct as number) ?? 0.025,
        state: 'earned',
        conversion_event_id: (params.conversion_event_id ?? item.context.conversion_event_id) as string | null,
      });

    if (accrualErr) {
      result.errors.push(`Failed to create CP commission accrual: ${accrualErr.message}`);
    } else {
      result.actions_taken.push(`CP commission accrual created at ${((params.commission_pct as number) ?? 0.025) * 100}%`);
    }
  }
}

async function handleUnmatchedWalkIn(
  item: ReconciliationItem,
  params: OverrideParams,
  result: ActionResult,
): Promise<void> {
  const sourceId = (params.source_id ?? item.context.suggested_source_id) as string | undefined;
  if (!sourceId) return;

  const supabase = getSupabaseAdmin();
  const phone = item.context.phone_e164 as string | undefined;
  const name = (item.context.name ?? 'Walk-In (Manual)') as string;

  const { error } = await supabase
    .schema('mih')
    .from('raw_leads')
    .insert({
      org_id: item.org_id,
      name,
      phone_e164: phone ?? '',
      source_id: sourceId,
      source_campaign_name: 'Walk-in (manual resolution)',
      ingested_at: new Date().toISOString(),
      dedup_status: 'unique',
      dedup_reason: 'walk_in_manual_resolution',
    });

  if (error) {
    result.errors.push(`Failed to create backfill lead: ${error.message}`);
  } else {
    result.actions_taken.push(`Walk-in backfilled as raw lead with source ${sourceId}`);
  }
}

async function handleManualCallNoTracking(
  item: ReconciliationItem,
  resolution: string,
  params: OverrideParams,
  result: ActionResult,
): Promise<void> {
  if (resolution !== 'accept_manual_call') return;

  const sourceId = (params.source_id ?? item.context.claimed_source_id) as string | undefined;
  const conversionEventId = (params.conversion_event_id ?? item.context.conversion_event_id) as string | undefined;
  if (!sourceId || !conversionEventId) return;

  const supabase = getSupabaseAdmin();
  const { data: model } = await supabase
    .schema('mih')
    .from('attribution_models')
    .select('id')
    .eq('org_id', item.org_id)
    .eq('model_code', 'first_touch_v1')
    .maybeSingle();

  if (!model) return;

  const { error } = await supabase
    .schema('mih')
    .from('attribution_results')
    .insert({
      org_id: item.org_id,
      conversion_event_id: conversionEventId,
      model_id: model.id,
      cluster_id: item.cluster_id,
      winning_source_id: sourceId,
      weight: 1.0,
      reason: 'manual_call_accepted',
      rule_applied: 'manual_override',
      computation_inputs: {
        reconciliation_item_id: item.id,
        resolution,
        note: 'Manual call accepted — no tracking number, evidence reviewed by ops',
      },
    });

  if (error) {
    result.errors.push(`Failed to create attribution result: ${error.message}`);
  } else {
    result.actions_taken.push(`Attribution created for manual call — source ${sourceId}`);
  }
}

async function handleLowConfMerge(
  item: ReconciliationItem,
  resolution: string,
  params: OverrideParams,
  result: ActionResult,
): Promise<void> {
  const clusterId1 = (params.cluster_id_1 ?? item.context.cluster_id_1) as string | undefined;
  const clusterId2 = (params.cluster_id_2 ?? item.context.cluster_id_2) as string | undefined;

  if (!clusterId1 || !clusterId2) return;

  const supabase = getSupabaseAdmin();

  if (resolution === 'approve_merge') {
    // Log the merge decision — actual merge would go through identity module
    await supabase.schema('mih').from('reconciliation_audit').insert({
      org_id: item.org_id,
      item_id: item.id,
      action: 'resolution_set',
      actor_id: 'system',
      note: `Merge approved for clusters ${clusterId1} and ${clusterId2}. Manual merge required in Identity module.`,
    });
    result.actions_taken.push(`Merge approved — clusters ${clusterId1} + ${clusterId2} flagged for merge`);
  } else if (resolution === 'household_link') {
    result.actions_taken.push(`Household link decision recorded — requires identity module action`);
  } else {
    result.actions_taken.push('Merge rejected — clusters remain separate');
  }
}
