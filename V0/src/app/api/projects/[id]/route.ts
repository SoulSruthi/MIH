import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const { id } = await params;

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }

  const { data: project, error } = await supabase
    .schema('mih')
    .from('projects')
    .select(`
      *,
      project_source_allowlist (*),
      project_stage_history (
        id, lifecycle_stage, changed_at, notes
      )
    `)
    .eq('org_id', orgId)
    .eq('id', id)
    .order('changed_at', { ascending: false, referencedTable: 'project_stage_history' })
    .limit(10, { referencedTable: 'project_stage_history' })
    .single();

  if (error || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({ project });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const allowedFields = [
    'display_name',
    'crm_project_id',
    'avg_sqft',
    'price_per_sqft',
    'fy_booking_target_count',
    'fy_booking_target_value',
    'marketing_spend_pct',
    'lifecycle_stage',
    'launch_date',
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }

  // Fetch current project to detect lifecycle_stage change
  const { data: existing, error: fetchError } = await supabase
    .schema('mih')
    .from('projects')
    .select('id, lifecycle_stage')
    .eq('org_id', orgId)
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { data: project, error: updateError } = await supabase
    .schema('mih')
    .from('projects')
    .update(updates)
    .eq('org_id', orgId)
    .eq('id', id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (
    'lifecycle_stage' in updates &&
    updates.lifecycle_stage !== existing.lifecycle_stage
  ) {
    await supabase
      .schema('mih')
      .from('project_stage_history')
      .insert({
        org_id: orgId,
        project_id: id,
        lifecycle_stage: updates.lifecycle_stage,
        changed_at: new Date().toISOString(),
      });
  }

  return NextResponse.json({ project });
}
