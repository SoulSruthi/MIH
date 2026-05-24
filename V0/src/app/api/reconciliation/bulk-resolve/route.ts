import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: { ids?: string[]; resolution?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const ids = body.ids ?? [];
  const resolution = body.resolution?.trim();

  if (!ids.length) return NextResponse.json({ error: 'ids array required' }, { status: 400 });
  if (!resolution) return NextResponse.json({ error: 'resolution required' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .schema('mih')
    .from('reconciliation_items')
    .update({
      state: 'resolved',
      resolution,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)
    .eq('org_id', orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ resolved: ids.length });
}
