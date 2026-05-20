import type { SupabaseClient } from '@supabase/supabase-js';
import type { AttributionRollup } from './types';
import { computeMetrics, aggregateFunnelCounts } from './compute';
import { getTotalSpendForPeriod } from '../spend/index';

export async function computeAndWriteRollup(
  supabase: SupabaseClient,
  orgId: string,
  sourceId: string,
  rollupDate: string,
): Promise<AttributionRollup> {
  // 1. Count unique leads for this source on this date
  const { count: leadCount } = await supabase
    .from('raw_leads')
    .select('unique_lead_id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('source_id', sourceId)
    .gte('ingested_at', rollupDate)
    .lt('ingested_at', nextDay(rollupDate));

  // 2. Get CRM lifecycle events for unique leads from this source on this date
  // Last-touch: source gets credit for events on unique leads it originated
  const { data: events } = await supabase
    .from('crm_lifecycle_events')
    .select('event_type, deal_value_paise')
    .eq('organization_id', orgId)
    .eq('source_id', sourceId)
    .gte('event_at', rollupDate)
    .lt('event_at', nextDay(rollupDate));

  // 3. Get spend for this date
  const spendPaise = await getTotalSpendForPeriod(supabase, orgId, sourceId, rollupDate, rollupDate);

  const funnelFromEvents = aggregateFunnelCounts(events ?? []);
  const funnel = { ...funnelFromEvents, uniqueLeads: leadCount ?? 0 };
  const spend = { spendPaise };

  const rollup = computeMetrics(orgId, sourceId, rollupDate, 'last_touch_v1', funnel, spend);

  // 4. Upsert rollup row
  const { error } = await supabase
    .from('attribution_rollups')
    .upsert({
      organization_id: orgId,
      source_id: sourceId,
      rollup_date: rollupDate,
      model_version: 'last_touch_v1',
      unique_lead_count: funnel.uniqueLeads,
      contacted_count: funnel.contacted,
      qualified_count: funnel.qualified,
      site_visit_count: funnel.siteVisit,
      deal_count: funnel.deals,
      won_count: funnel.won,
      won_value_paise: funnel.wonValuePaise,
      spend_paise: spendPaise,
      cpl_paise: rollup.cplPaise,
      cpa_paise: rollup.cpaPaise,
      roas_times_100: rollup.roasTimes100,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,source_id,rollup_date,model_version' });

  if (error) throw new Error(`Failed to write attribution rollup: ${error.message}`);
  return rollup;
}

function nextDay(date: string): string {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0] as string;
}

export async function recomputeRollupsForRange(
  supabase: SupabaseClient,
  orgId: string,
  startDate: string,
  endDate: string,
): Promise<{ processed: number; errors: number }> {
  // Get all active sources for org
  const { data: sources } = await supabase
    .from('sources')
    .select('id')
    .eq('organization_id', orgId);

  let processed = 0;
  let errors = 0;

  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0] as string;
    for (const source of sources ?? []) {
      try {
        await computeAndWriteRollup(supabase, orgId, source.id, dateStr);
        processed++;
      } catch {
        errors++;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return { processed, errors };
}
