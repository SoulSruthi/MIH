import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('spend_entries')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .single();

  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ entry: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('spend_entries')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .schema('mih')
    .from('spend_entries')
    .delete()
    .eq('id', params.id)
    .eq('org_id', orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
