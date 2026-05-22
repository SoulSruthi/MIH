import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { calculateCPB, calculateCPL } from './cpb-calculator';
import type { FunnelBySource } from './types';

export async function getFunnelBySource(
  orgId: string,
  params: {
    periodStart?: string;
    periodEnd?: string;
    projectId?: string;
  } = {},
): Promise<FunnelBySource[]> {
  const supabase = getSupabaseAdmin();

  const { data: sources, error: sourcesError } = await supabase
    .schema('mih')
    .from('sources')
    .select('id, display_name')
    .eq('org_id', orgId);

  if (sourcesError) throw new Error(sourcesError.message);
  if (!sources || sources.length === 0) return [];

  let spendQuery = supabase
    .schema('mih')
    .from('spend_entries')
    .select('source_id, amount_paise')
    .eq('org_id', orgId);

  if (params.periodStart) spendQuery = spendQuery.gte('period_start', params.periodStart);
  if (params.periodEnd) spendQuery = spendQuery.lte('period_end', params.periodEnd);
  if (params.projectId) spendQuery = spendQuery.eq('project_id', params.projectId);

  const { data: spendData } = await spendQuery;

  const spendBySource: Record<string, number> = {};
  for (const entry of spendData ?? []) {
    if (entry.source_id) {
      spendBySource[entry.source_id] = (spendBySource[entry.source_id] ?? 0) + entry.amount_paise;
    }
  }

  let leadsQuery = supabase
    .schema('mih')
    .from('raw_inbox')
    .select('source_id, is_qualified')
    .eq('org_id', orgId);

  if (params.periodStart) leadsQuery = leadsQuery.gte('created_at', params.periodStart);
  if (params.periodEnd) leadsQuery = leadsQuery.lte('created_at', params.periodEnd);

  const { data: leadsData } = await leadsQuery;

  const leadsBySource: Record<string, { total: number; qualified: number }> = {};
  for (const lead of leadsData ?? []) {
    if (lead.source_id) {
      if (!leadsBySource[lead.source_id]) leadsBySource[lead.source_id] = { total: 0, qualified: 0 };
      leadsBySource[lead.source_id].total += 1;
      if (lead.is_qualified) leadsBySource[lead.source_id].qualified += 1;
    }
  }

  const { data: bookingsData } = await supabase
    .schema('mih')
    .from('attribution_results')
    .select('source_id')
    .eq('org_id', orgId);

  const bookingsBySource: Record<string, number> = {};
  for (const b of bookingsData ?? []) {
    if (b.source_id) {
      bookingsBySource[b.source_id] = (bookingsBySource[b.source_id] ?? 0) + 1;
    }
  }

  return sources.map((src) => {
    const spend = spendBySource[src.id] ?? 0;
    const leadInfo = leadsBySource[src.id] ?? { total: 0, qualified: 0 };
    const bookings = bookingsBySource[src.id] ?? 0;

    return {
      source_id: src.id,
      source_name: src.display_name as string,
      leads: leadInfo.total,
      qualified: leadInfo.qualified,
      site_visits: 0,
      bookings,
      spend,
      cpb: calculateCPB(spend, bookings),
      cpl: calculateCPL(spend, leadInfo.total),
    };
  });
}

export async function getFunnelByProject(
  orgId: string,
  params: {
    periodStart?: string;
    periodEnd?: string;
  } = {},
): Promise<Array<{
  project_id: string;
  project_name: string;
  leads: number;
  bookings: number;
  spend: number;
  cpb: number;
}>> {
  const supabase = getSupabaseAdmin();

  const { data: projects } = await supabase
    .schema('mih')
    .from('projects')
    .select('id, display_name')
    .eq('org_id', orgId);

  if (!projects || projects.length === 0) return [];

  let spendQuery = supabase
    .schema('mih')
    .from('spend_entries')
    .select('project_id, amount_paise')
    .eq('org_id', orgId);

  if (params.periodStart) spendQuery = spendQuery.gte('period_start', params.periodStart);
  if (params.periodEnd) spendQuery = spendQuery.lte('period_end', params.periodEnd);

  const { data: spendData } = await spendQuery;
  const spendByProject: Record<string, number> = {};
  for (const entry of spendData ?? []) {
    if (entry.project_id) {
      spendByProject[entry.project_id] = (spendByProject[entry.project_id] ?? 0) + entry.amount_paise;
    }
  }

  return projects.map((proj) => {
    const spend = spendByProject[proj.id] ?? 0;
    return {
      project_id: proj.id,
      project_name: proj.display_name as string,
      leads: 0,
      bookings: 0,
      spend,
      cpb: 0,
    };
  });
}
