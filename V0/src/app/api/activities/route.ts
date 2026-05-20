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
  const project_id = searchParams.get('project_id');
  const source_id = searchParams.get('source_id');
  const state = searchParams.get('state');

  let query = supabase
    .schema('mih')
    .from('activities')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (project_id) query = query.eq('project_id', project_id);
  if (source_id) query = query.eq('source_id', source_id);
  if (state) query = query.eq('lifecycle_state', state);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ activities: data ?? [] });
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

  const {
    activity_code, display_name, activity_type, source_id,
    project_id, location, start_date, end_date, metadata,
  } = body as Record<string, string | undefined>;

  if (!activity_code || !display_name || !activity_type) {
    return NextResponse.json(
      { error: 'activity_code, display_name, and activity_type are required' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .schema('mih')
    .from('activities')
    .insert({
      org_id: orgId,
      activity_code,
      display_name,
      activity_type,
      source_id: source_id ?? null,
      project_id: project_id ?? null,
      location: location ?? null,
      start_date: start_date ?? null,
      end_date: end_date ?? null,
      metadata: metadata ?? {},
      lifecycle_state: 'active',
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'activity_code already exists for this org' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ activity: data }, { status: 201 });
}
