import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '12'), 60);

  // Verify CP belongs to org
  const { data: cp, error: cpError } = await supabase
    .schema('mih')
    .from('channel_partners')
    .select('id, name, code, is_active')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (cpError) return NextResponse.json({ error: cpError.message }, { status: 500 });
  if (!cp) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data, error } = await supabase
    .schema('mih')
    .from('cp_performance')
    .select('*')
    .eq('channel_partner_id', params.id)
    .eq('org_id', orgId)
    .order('month_year', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ channel_partner: cp, performance: data ?? [], limit });
}
