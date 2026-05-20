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

  const { searchParams } = new URL(req.url);
  const state = searchParams.get('state') ?? 'active';
  const cluster_type = searchParams.get('cluster_type');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  let query = supabase
    .schema('mih')
    .from('identity_clusters')
    .select(`
      *,
      golden_records (
        id, primary_phone, primary_name, primary_email,
        first_touch_at, last_touch_at,
        first_touch_source_id, last_touch_source_id
      )
    `)
    .eq('org_id', orgId)
    .eq('state', state)
    .order('last_activity_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (cluster_type) query = query.eq('cluster_type', cluster_type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ clusters: data ?? [], limit, offset });
}
