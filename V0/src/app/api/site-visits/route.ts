import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get('project_id');
  const event_kind = searchParams.get('event_kind');
  const date_from = searchParams.get('date_from');
  const date_to = searchParams.get('date_to');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);

  let query = supabase
    .schema('mih')
    .from('site_visit_events')
    .select(`
      *,
      identity_clusters (
        id, cluster_type, state
      )
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (project_id) query = query.eq('project_id', project_id);
  if (event_kind) query = query.eq('event_kind', event_kind);
  if (date_from) query = query.gte('created_at', date_from);
  if (date_to) query = query.lte('created_at', date_to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site_visits: data ?? [], limit });
}
