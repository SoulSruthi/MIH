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
  const cluster_id = searchParams.get('cluster_id');
  const model_id = searchParams.get('model_id');
  const source_id = searchParams.get('source_id');
  const include_superseded = searchParams.get('include_superseded') === 'true';

  let query = supabase
    .schema('mih')
    .from('attribution_results')
    .select(`
      *,
      conversion_events (
        event_code,
        occurred_at
      )
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (cluster_id) query = query.eq('cluster_id', cluster_id);
  if (model_id) query = query.eq('model_id', model_id);
  if (source_id) query = query.eq('source_id', source_id);
  if (!include_superseded) query = query.eq('is_superseded', false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attribution_results: data ?? [] });
}
