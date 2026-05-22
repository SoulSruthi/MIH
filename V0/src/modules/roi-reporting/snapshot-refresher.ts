import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { computeCPBMetrics } from './cpb-calculator';
import type { MetricSnapshot, Granularity } from './types';

export async function computeMetricSet(
  orgId: string,
  periodStart: string,
  periodEnd: string,
  dimensionKey: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  let spendQuery = supabase
    .schema('mih')
    .from('spend_entries')
    .select('amount_paise')
    .eq('org_id', orgId)
    .gte('period_start', periodStart)
    .lte('period_end', periodEnd);

  if (dimensionKey.project_id) {
    spendQuery = spendQuery.eq('project_id', dimensionKey.project_id as string);
  }
  if (dimensionKey.source_id) {
    spendQuery = spendQuery.eq('source_id', dimensionKey.source_id as string);
  }

  const { data: spendData } = await spendQuery;
  const totalSpend = (spendData ?? []).reduce((acc, e) => acc + (e.amount_paise ?? 0), 0);

  let leadsQuery = supabase
    .schema('mih')
    .from('raw_inbox')
    .select('id, is_qualified')
    .eq('org_id', orgId)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd);

  if (dimensionKey.source_id) {
    leadsQuery = leadsQuery.eq('source_id', dimensionKey.source_id as string);
  }

  const { data: leadsData } = await leadsQuery;
  const totalLeads = leadsData?.length ?? 0;
  const totalQualified = (leadsData ?? []).filter((l) => l.is_qualified).length;

  const metrics = computeCPBMetrics({
    totalSpend,
    totalBookings: 0,
    totalLeads,
    totalQualifiedLeads: totalQualified,
    periodStart,
    periodEnd,
  });

  return {
    ...metrics,
    dimension_key: dimensionKey,
  };
}

export async function refreshMetricSnapshot(
  orgId: string,
  granularity: Granularity,
  periodStart: string,
  periodEnd: string,
  dimensionKey: Record<string, unknown> = {},
): Promise<MetricSnapshot> {
  const supabase = getSupabaseAdmin();
  const metricSet = await computeMetricSet(orgId, periodStart, periodEnd, dimensionKey);

  const { data, error } = await supabase
    .schema('mih')
    .from('metric_snapshots')
    .upsert(
      {
        org_id: orgId,
        granularity,
        period_start: periodStart,
        period_end: periodEnd,
        dimension_key: dimensionKey,
        metric_set: metricSet,
        refreshed_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,granularity,period_start,dimension_key' },
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as MetricSnapshot;
}

export async function listSnapshots(
  orgId: string,
  granularity?: Granularity,
  limit = 30,
): Promise<MetricSnapshot[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .schema('mih')
    .from('metric_snapshots')
    .select('*')
    .eq('org_id', orgId)
    .order('period_start', { ascending: false })
    .limit(limit);

  if (granularity) query = query.eq('granularity', granularity);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MetricSnapshot[];
}
