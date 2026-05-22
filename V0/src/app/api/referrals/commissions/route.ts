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
  const status = searchParams.get('status');
  const referrer_id = searchParams.get('referrer_id');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);

  let query = supabase
    .schema('mih')
    .from('referral_commissions')
    .select('*, referral_events(referrer_id, referee_cluster_id, project_id)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter by referrer_id in post-processing if requested (via join)
  const filtered = referrer_id
    ? (data ?? []).filter(
        (c: { referral_events: { referrer_id: string } | null }) =>
          c.referral_events?.referrer_id === referrer_id,
      )
    : (data ?? []);

  return NextResponse.json({ commissions: filtered, limit });
}
