import type { SupabaseClient } from '@supabase/supabase-js';
import type { SpendInput, SpendEntry, SpendCompletenessStatus } from './types.js';

export async function upsertSpend(
  supabase: SupabaseClient,
  input: SpendInput,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('spend_daily')
    .upsert({
      organization_id: input.organizationId,
      source_id: input.sourceId,
      spend_date: input.spendDate,
      amount_paise: input.amountPaise,
      currency: 'INR',
      campaign_id: input.campaignId ?? null,
      campaign_name: input.campaignName ?? null,
      data_source: input.dataSource,
      raw_payload: input.rawPayload ?? null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'organization_id,source_id,spend_date,campaign_id',
    })
    .select('id')
    .single();
  if (error) throw new Error(`upsertSpend failed: ${error.message}`);
  return { id: data.id };
}

export async function getSpendForPeriod(
  supabase: SupabaseClient,
  orgId: string,
  sourceId: string,
  startDate: string,
  endDate: string,
): Promise<SpendEntry[]> {
  const { data, error } = await supabase
    .from('spend_daily')
    .select('id, organization_id, source_id, spend_date, amount_paise, currency, campaign_id, campaign_name, data_source, superseded_by, created_at')
    .eq('organization_id', orgId)
    .eq('source_id', sourceId)
    .is('superseded_by', null)
    .gte('spend_date', startDate)
    .lte('spend_date', endDate)
    .order('spend_date');
  if (error) throw new Error(`getSpendForPeriod failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    sourceId: r.source_id,
    spendDate: r.spend_date,
    amountPaise: r.amount_paise,
    currency: r.currency,
    campaignId: r.campaign_id,
    campaignName: r.campaign_name,
    dataSource: r.data_source,
    supersededBy: r.superseded_by,
    createdAt: r.created_at,
  }));
}

export async function getTotalSpendForPeriod(
  supabase: SupabaseClient,
  orgId: string,
  sourceId: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  const entries = await getSpendForPeriod(supabase, orgId, sourceId, startDate, endDate);
  return entries.reduce((sum, e) => sum + e.amountPaise, 0);
}

export function getSpendCompleteness(
  entries: SpendEntry[],
  activeDays: number,
): SpendCompletenessStatus {
  if (activeDays === 0) return 'missing';
  const daysWithSpend = new Set(entries.map((e) => e.spendDate)).size;
  if (daysWithSpend === 0) return 'missing';
  if (daysWithSpend < activeDays) return 'partial';
  return 'complete';
}

export type { DataSource, SpendEntry, SpendInput, SpendSummary, SpendCompletenessStatus } from './types.js';
