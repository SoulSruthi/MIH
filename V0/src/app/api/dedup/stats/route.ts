import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  // Total clusters vs total raw_inbox count → duplicate rate
  const { data: clusters, error: clusterErr } = await supabase
    .schema('mih')
    .from('identity_clusters')
    .select('id, raw_lead_count, source_count, cluster_type, state')
    .eq('org_id', orgId);

  if (clusterErr) return NextResponse.json({ error: clusterErr.message }, { status: 500 });

  const clusterList = (clusters ?? []) as Array<{
    id: string;
    raw_lead_count: number;
    source_count: number;
    cluster_type: string;
    state: string;
  }>;

  const totalClusters = clusterList.filter((c) => c.state === 'active').length;
  const totalRawLeads = clusterList.reduce((sum, c) => sum + c.raw_lead_count, 0);
  const duplicates = totalRawLeads - totalClusters;
  const dupRate = totalRawLeads > 0 ? Math.round((duplicates / totalRawLeads) * 1000) / 10 : 0;

  // Per-source stats via raw_inbox
  const { data: sourceStats } = await supabase
    .schema('mih')
    .from('raw_inbox')
    .select('source_id, processing_state')
    .eq('org_id', orgId);

  const bySource: Record<string, { total: number; processed: number }> = {};
  for (const row of (sourceStats ?? []) as Array<{ source_id: string | null; processing_state: string }>) {
    const key = row.source_id ?? 'unknown';
    if (!bySource[key]) bySource[key] = { total: 0, processed: 0 };
    bySource[key].total++;
    if (row.processing_state !== 'pending') bySource[key].processed++;
  }

  return NextResponse.json({
    total_clusters: totalClusters,
    total_raw_leads: totalRawLeads,
    duplicates,
    duplicate_rate_pct: dupRate,
    by_source: bySource,
  });
}
