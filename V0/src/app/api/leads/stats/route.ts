import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type SourceStat = {
  source_id: string;
  source_name: string;
  source_type: string;
  total_leads: number;
  unique_count: number;
  duplicate_count: number;
  pending_count: number;
  dedup_rate_pct: number | null;
};

export type LeadStatsResponse = {
  totals: {
    raw_leads: number;
    unique_leads: number;
    duplicates: number;
    pending: number;
    dedup_rate_pct: number | null;
  };
  sources: SourceStat[];
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const { data: sources, error: srcErr } = await supabase
    .from('source_lead_stats')
    .select('source_id, source_name, source_type, total_leads, unique_count, duplicate_count, pending_count, dedup_rate_pct')
    .eq('organization_id', orgId)
    .order('total_leads', { ascending: false });

  if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 500 });

  const rows = (sources ?? []) as SourceStat[];
  const totals = rows.reduce(
    (acc, r) => ({
      raw_leads: acc.raw_leads + r.total_leads,
      unique_leads: acc.unique_leads + r.unique_count,
      duplicates: acc.duplicates + r.duplicate_count,
      pending: acc.pending + r.pending_count,
    }),
    { raw_leads: 0, unique_leads: 0, duplicates: 0, pending: 0 },
  );

  const processed = totals.unique_leads + totals.duplicates;
  const dedup_rate_pct = processed > 0
    ? Math.round((totals.duplicates / processed) * 1000) / 10
    : null;

  const response: LeadStatsResponse = {
    totals: { ...totals, dedup_rate_pct },
    sources: rows,
  };

  return NextResponse.json(response);
}
