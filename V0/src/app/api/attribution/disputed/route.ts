import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const VALID_STATES = new Set(['open', 'in_review', 'resolved', 'escalated']);

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
  const state = searchParams.get('state');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);

  if (state && !VALID_STATES.has(state)) {
    return NextResponse.json(
      { error: `Invalid state. Must be one of: ${[...VALID_STATES].join(', ')}` },
      { status: 400 },
    );
  }

  let query = supabase
    .schema('mih')
    .from('disputed_attributions')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (state) query = query.eq('state', state);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ disputed_attributions: data ?? [], limit });
}
