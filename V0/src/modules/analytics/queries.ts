import type { SupabaseClient } from '@supabase/supabase-js';

export type PeriodFilter = 'today' | '7d' | '30d';

function periodStart(period: PeriodFilter): string {
  const now = new Date();
  if (period === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (period === '7d') {
    return new Date(now.getTime() - 7 * 86_400_000).toISOString();
  }
  return new Date(now.getTime() - 30 * 86_400_000).toISOString();
}

export type LeadVolumeSummary = {
  raw_leads: number;
  unique_leads: number;
  duplicates: number;
  dedup_rate_pct: number;
};

export type HandoffStatusSummary = {
  pending: number;
  queued: number;
  succeeded: number;
  failed: number;
  skipped: number;
};

export type SourceRow = {
  source_id: string;
  source_name: string;
  source_type: string;
  raw: number;
  unique: number;
  dup_pct: number;
  crm_success: number;
};

export type RecentLead = {
  id: string;
  primary_name: string;
  primary_phone_e164: string;
  source_name: string | null;
  dedup_status: string;
  crm_handoff_status: string;
  ingested_at: string;
};

export async function getLeadVolumeSummary(
  supabase: SupabaseClient,
  orgId: string,
  period: PeriodFilter,
): Promise<LeadVolumeSummary> {
  const since = periodStart(period);

  const { data, error } = await supabase
    .from('raw_leads')
    .select('dedup_status')
    .eq('organization_id', orgId)
    .gte('ingested_at', since);

  if (error) throw new Error(`getLeadVolumeSummary: ${error.message}`);

  const rows = data ?? [];
  const raw = rows.length;
  const unique = rows.filter((r) => r.dedup_status === 'unique').length;
  const duplicates = rows.filter((r) => r.dedup_status === 'duplicate').length;
  const decided = unique + duplicates;
  const dedup_rate_pct = decided > 0 ? Math.round((duplicates / decided) * 100 * 10) / 10 : 0;

  return { raw_leads: raw, unique_leads: unique, duplicates, dedup_rate_pct };
}

export async function getHandoffStatusSummary(
  supabase: SupabaseClient,
  orgId: string,
  period: PeriodFilter,
): Promise<HandoffStatusSummary> {
  const since = periodStart(period);

  const { data, error } = await supabase
    .from('unique_leads')
    .select('crm_handoff_status')
    .eq('organization_id', orgId)
    .gte('created_at', since);

  if (error) throw new Error(`getHandoffStatusSummary: ${error.message}`);

  const rows = data ?? [];
  const count = (s: string) => rows.filter((r) => r.crm_handoff_status === s).length;

  return {
    pending: count('pending'),
    queued: count('queued'),
    succeeded: count('succeeded'),
    failed: count('failed'),
    skipped: count('skipped'),
  };
}

export async function getSourceBreakdown(
  supabase: SupabaseClient,
  orgId: string,
  period: PeriodFilter,
): Promise<SourceRow[]> {
  const since = periodStart(period);

  const { data, error } = await supabase
    .from('raw_leads')
    .select(`
      source_id,
      dedup_status,
      unique_lead_id,
      sources!source_id(id, name, source_type)
    `)
    .eq('organization_id', orgId)
    .gte('ingested_at', since);

  if (error) throw new Error(`getSourceBreakdown: ${error.message}`);

  const rows = data ?? [];
  const bySource = new Map<string, { name: string; type: string; raw: number; unique: number; dups: number }>();

  for (const row of rows) {
    const rowRec = row as Record<string, unknown>;
    const src = (Array.isArray(rowRec['sources']) ? rowRec['sources'][0] : rowRec['sources']) as { id: string; name: string; source_type: string } | null;
    const sid = rowRec['source_id'] as string;
    if (!bySource.has(sid)) {
      bySource.set(sid, { name: src?.name ?? 'Unknown', type: src?.source_type ?? '', raw: 0, unique: 0, dups: 0 });
    }
    const s = bySource.get(sid)!;
    s.raw++;
    if (rowRec['dedup_status'] === 'unique') s.unique++;
    if (rowRec['dedup_status'] === 'duplicate') s.dups++;
  }

  // Get CRM success counts per source
  const sourceIds = Array.from(bySource.keys());
  let crmSuccessBySource: Map<string, number> = new Map();

  if (sourceIds.length > 0) {
    const { data: handoffData } = await supabase
      .from('unique_leads')
      .select('primary_source_id, crm_handoff_status')
      .eq('organization_id', orgId)
      .eq('crm_handoff_status', 'succeeded')
      .gte('created_at', since)
      .in('primary_source_id', sourceIds);

    for (const h of handoffData ?? []) {
      const sid = h.primary_source_id as string;
      crmSuccessBySource.set(sid, (crmSuccessBySource.get(sid) ?? 0) + 1);
    }
  }

  return Array.from(bySource.entries())
    .map(([sid, s]) => ({
      source_id: sid,
      source_name: s.name,
      source_type: s.type,
      raw: s.raw,
      unique: s.unique,
      dup_pct: s.raw > 0 ? Math.round((s.dups / s.raw) * 100) : 0,
      crm_success: crmSuccessBySource.get(sid) ?? 0,
    }))
    .sort((a, b) => b.raw - a.raw);
}

export async function getRecentLeads(
  supabase: SupabaseClient,
  orgId: string,
  limit = 50,
): Promise<RecentLead[]> {
  const { data, error } = await supabase
    .from('raw_leads')
    .select(`
      id,
      name,
      phone_e164,
      ingested_at,
      dedup_status,
      unique_lead_id,
      sources!source_id(name),
      unique_leads!unique_lead_id(crm_handoff_status)
    `)
    .eq('organization_id', orgId)
    .order('ingested_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRecentLeads: ${error.message}`);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    primary_name: row.name as string,
    primary_phone_e164: row.phone_e164 as string,
    source_name: (row.sources as { name: string } | null)?.name ?? null,
    dedup_status: row.dedup_status as string,
    crm_handoff_status: ((row.unique_leads as { crm_handoff_status: string } | null)?.crm_handoff_status) ?? 'n/a',
    ingested_at: row.ingested_at as string,
  }));
}
