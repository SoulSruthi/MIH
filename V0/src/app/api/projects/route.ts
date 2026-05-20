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

  const { data, error } = await supabase
    .schema('mih')
    .from('projects')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data ?? [] });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: {
    display_name?: string;
    crm_project_id?: string;
    avg_sqft?: number;
    price_per_sqft?: number;
    fy_booking_target_count?: number;
    fy_booking_target_value?: number;
    marketing_spend_pct?: number;
    lifecycle_stage?: string;
    launch_date?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.display_name) {
    return NextResponse.json({ error: 'display_name is required' }, { status: 400 });
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }

  const { data: project, error: projectError } = await supabase
    .schema('mih')
    .from('projects')
    .insert({
      org_id: orgId,
      display_name: body.display_name,
      crm_project_id: body.crm_project_id ?? null,
      avg_sqft: body.avg_sqft ?? null,
      price_per_sqft: body.price_per_sqft ?? null,
      fy_booking_target_count: body.fy_booking_target_count ?? null,
      fy_booking_target_value: body.fy_booking_target_value ?? null,
      marketing_spend_pct: body.marketing_spend_pct ?? null,
      lifecycle_stage: body.lifecycle_stage ?? null,
      launch_date: body.launch_date ?? null,
    })
    .select()
    .single();

  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 });

  if (body.lifecycle_stage) {
    await supabase
      .schema('mih')
      .from('project_stage_history')
      .insert({
        org_id: orgId,
        project_id: project.id,
        lifecycle_stage: body.lifecycle_stage,
        changed_at: new Date().toISOString(),
      });
  }

  return NextResponse.json({ project }, { status: 201 });
}
