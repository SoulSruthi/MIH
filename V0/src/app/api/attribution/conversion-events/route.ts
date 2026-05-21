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
  const event_code = searchParams.get('event_code');
  const project_id = searchParams.get('project_id');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);

  let query = supabase
    .schema('mih')
    .from('conversion_events')
    .select('*')
    .eq('org_id', orgId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (cluster_id) query = query.eq('cluster_id', cluster_id);
  if (event_code) query = query.eq('event_code', event_code);
  if (project_id) query = query.eq('project_id', project_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversion_events: data ?? [], limit });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: {
    cluster_id?: string;
    event_code?: string;
    project_id?: string;
    deal_value_paise?: number;
    occurred_at?: string;
    crm_event_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.cluster_id || !body.event_code || !body.occurred_at) {
    return NextResponse.json(
      { error: 'cluster_id, event_code, and occurred_at are required' },
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
    .from('conversion_events')
    .insert({
      org_id: orgId,
      cluster_id: body.cluster_id,
      event_code: body.event_code,
      project_id: body.project_id ?? null,
      deal_value_paise: body.deal_value_paise ?? null,
      occurred_at: body.occurred_at,
      crm_event_id: body.crm_event_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversion_event: data }, { status: 201 });
}
