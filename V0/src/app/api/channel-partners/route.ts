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
  const is_active = searchParams.get('is_active');

  let query = supabase
    .schema('mih')
    .from('channel_partners')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (is_active !== null) query = query.eq('is_active', is_active === 'true');

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ channel_partners: data ?? [] });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: {
    name?: string;
    code?: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }

  const { data, error } = await supabase
    .schema('mih')
    .from('channel_partners')
    .insert({
      org_id: orgId,
      name: body.name,
      code: body.code ?? null,
      contact_name: body.contact_name ?? null,
      contact_email: body.contact_email ?? null,
      contact_phone: body.contact_phone ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ channel_partner: data }, { status: 201 });
}
