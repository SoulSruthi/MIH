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

  const { data, error } = await supabase
    .schema('mih')
    .from('connectors')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ connectors: data ?? [] });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { connector_type, display_name, source_id, config_encrypted } = body as {
    connector_type?: string;
    display_name?: string;
    source_id?: string;
    config_encrypted?: Record<string, unknown>;
  };

  if (!connector_type || !display_name) {
    return NextResponse.json(
      { error: 'connector_type and display_name are required' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .schema('mih')
    .from('connectors')
    .insert({
      org_id: orgId,
      connector_type,
      display_name,
      source_id: source_id ?? null,
      config_encrypted: config_encrypted ?? {},
      is_active: true,
      health_state: 'healthy',
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ connector: data }, { status: 201 });
}
