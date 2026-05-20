import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * POST /api/clusters/merge
 * Manual merge of N clusters into one target cluster.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { target_cluster_id, source_cluster_ids } = body as {
    target_cluster_id?: string;
    source_cluster_ids?: string[];
  };

  if (!target_cluster_id || !source_cluster_ids || source_cluster_ids.length === 0) {
    return NextResponse.json(
      { error: 'target_cluster_id and source_cluster_ids are required' },
      { status: 400 },
    );
  }

  // Verify target cluster belongs to org
  const { data: target, error: targetErr } = await supabase
    .schema('mih')
    .from('identity_clusters')
    .select('id, state')
    .eq('org_id', orgId)
    .eq('id', target_cluster_id)
    .single();

  if (targetErr || !target) {
    return NextResponse.json({ error: 'Target cluster not found' }, { status: 404 });
  }

  // Mark source clusters as merged_into target
  const { error: mergeErr } = await supabase
    .schema('mih')
    .from('identity_clusters')
    .update({ state: 'merged_into', merged_into_id: target_cluster_id })
    .eq('org_id', orgId)
    .in('id', source_cluster_ids);

  if (mergeErr) return NextResponse.json({ error: mergeErr.message }, { status: 500 });

  // Audit: write link_event
  await supabase
    .schema('mih')
    .from('link_events')
    .insert({
      org_id: orgId,
      event_type: 'merge',
      cluster_id: target_cluster_id,
      affected_clusters: [target_cluster_id, ...source_cluster_ids],
      rule_applied: 'manual_merge',
      confidence: 1.0,
      triggered_by: 'user',
      details: { source_cluster_ids },
    });

  return NextResponse.json({
    merged: true,
    target_cluster_id,
    absorbed: source_cluster_ids,
  });
}
