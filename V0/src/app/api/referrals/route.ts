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
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);

  let query = supabase
    .schema('mih')
    .from('referrers')
    .select('*, referral_events(count)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status === 'active') query = query.eq('is_active', true);
  if (status === 'dormant') {
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
    query = query.eq('is_active', true).or(`last_referral_at.is.null,last_referral_at.lte.${cutoff}`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ referrers: data ?? [], limit });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: {
    customer_cluster_id?: string;
    name?: string;
    contact_email?: string;
    contact_phone?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.name && !body.customer_cluster_id) {
    return NextResponse.json(
      { error: 'Either name or customer_cluster_id is required' },
      { status: 400 },
    );
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }

  const { data, error } = await supabase
    .schema('mih')
    .from('referrers')
    .insert({
      org_id: orgId,
      customer_cluster_id: body.customer_cluster_id ?? null,
      name: body.name ?? null,
      contact_email: body.contact_email ?? null,
      contact_phone: body.contact_phone ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ referrer: data }, { status: 201 });
}
