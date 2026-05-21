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
  const monthParam = searchParams.get('month');

  // Default to current month in YYYY-MM format
  const targetMonth = monthParam ?? new Date().toISOString().slice(0, 7);

  // Validate YYYY-MM format
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
    return NextResponse.json({ error: 'month must be in YYYY-MM format' }, { status: 400 });
  }

  const { data, error } = await supabase
    .schema('mih')
    .from('portal_visit_targets')
    .select('*')
    .eq('org_id', orgId)
    .eq('target_month', targetMonth)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ portal_targets: data ?? [], target_month: targetMonth });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: {
    source_id?: string;
    project_id?: string;
    target_month?: string;
    target_count?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.source_id || !body.project_id || !body.target_month || body.target_count == null) {
    return NextResponse.json(
      { error: 'source_id, project_id, target_month, and target_count are required' },
      { status: 400 },
    );
  }

  if (!/^\d{4}-\d{2}$/.test(body.target_month)) {
    return NextResponse.json({ error: 'target_month must be in YYYY-MM format' }, { status: 400 });
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }

  const { data, error } = await supabase
    .schema('mih')
    .from('portal_visit_targets')
    .upsert(
      {
        org_id: orgId,
        source_id: body.source_id,
        project_id: body.project_id,
        target_month: body.target_month,
        target_count: body.target_count,
      },
      { onConflict: 'org_id,source_id,project_id,target_month' },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ portal_target: data }, { status: 201 });
}
