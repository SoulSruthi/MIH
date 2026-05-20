import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const { id } = await params;

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  // Get cluster with golden record
  const { data: cluster, error: clusterErr } = await supabase
    .schema('mih')
    .from('identity_clusters')
    .select(`
      *,
      golden_records (*),
      identity_edges (
        id, edge_type, confidence, rule_applied, created_at,
        identity_nodes (id, attribute_type, attribute_value, confidence, observed_at)
      )
    `)
    .eq('org_id', orgId)
    .eq('id', id)
    .single();

  if (clusterErr || !cluster) {
    return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
  }

  // Get raw inbox leads for this cluster (via identity_nodes → raw_inbox)
  const { data: rawLeads } = await supabase
    .schema('mih')
    .from('raw_inbox')
    .select('id, received_at, source_received_at, source_id, ingestion_path, processing_state, normalized')
    .eq('org_id', orgId)
    .in(
      'id',
      (cluster as { identity_edges: { identity_nodes: { id: string } }[] }).identity_edges
        .map((e) => e.identity_nodes?.id)
        .filter(Boolean),
    )
    .order('received_at', { ascending: false });

  return NextResponse.json({ cluster, raw_leads: rawLeads ?? [] });
}
