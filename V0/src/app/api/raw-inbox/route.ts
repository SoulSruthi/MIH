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
  const source_id = searchParams.get('source_id');
  const processing_state = searchParams.get('processing_state');
  const date_from = searchParams.get('date_from');
  const date_to = searchParams.get('date_to');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  let query = supabase
    .schema('mih')
    .from('raw_inbox')
    .select('*')
    .eq('org_id', orgId)
    .order('received_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (source_id) query = query.eq('source_id', source_id);
  if (processing_state) query = query.eq('processing_state', processing_state);
  if (date_from) query = query.gte('received_at', date_from);
  if (date_to) query = query.lte('received_at', date_to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ leads: data ?? [], limit, offset });
}
