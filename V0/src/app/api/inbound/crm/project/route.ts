import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function verifyHmac(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  return signature === expected;
}

type ProjectSyncBody = {
  crm_project_id: string;
  display_name: string;
  lifecycle_stage?: string;
  avg_sqft?: number;
  price_per_sqft?: number;
  fy_booking_target_count?: number;
  fy_booking_target_value?: number;
  marketing_spend_pct?: number;
  launch_date?: string;
  marketing_manager_user_id?: string;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-mih-signature');

  if (!verifyHmac(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: ProjectSyncBody;
  try {
    body = JSON.parse(rawBody) as ProjectSyncBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.crm_project_id || !body.display_name) {
    return NextResponse.json({ error: 'crm_project_id and display_name are required' }, { status: 400 });
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }

  // Check if project already exists (for lifecycle_stage change detection)
  const { data: existing } = await supabase
    .schema('mih')
    .from('projects')
    .select('id, lifecycle_stage')
    .eq('org_id', orgId)
    .eq('crm_project_id', body.crm_project_id)
    .maybeSingle();

  const now = new Date().toISOString();
  const isInsert = !existing;
  const previousLifecycleStage = existing
    ? (existing as Record<string, unknown>).lifecycle_stage as string | null
    : null;
  const lifecycleStageChanged =
    !isInsert &&
    body.lifecycle_stage !== undefined &&
    body.lifecycle_stage !== previousLifecycleStage;

  // Upsert into mih.projects on conflict (org_id, crm_project_id)
  const upsertPayload: Record<string, unknown> = {
    org_id: orgId,
    crm_project_id: body.crm_project_id,
    display_name: body.display_name,
    crm_synced_at: now,
    updated_at: now,
  };

  if (body.lifecycle_stage !== undefined) upsertPayload.lifecycle_stage = body.lifecycle_stage;
  if (body.avg_sqft !== undefined) upsertPayload.avg_sqft = body.avg_sqft;
  if (body.price_per_sqft !== undefined) upsertPayload.price_per_sqft = body.price_per_sqft;
  if (body.fy_booking_target_count !== undefined) upsertPayload.fy_booking_target_count = body.fy_booking_target_count;
  if (body.fy_booking_target_value !== undefined) upsertPayload.fy_booking_target_value = body.fy_booking_target_value;
  if (body.marketing_spend_pct !== undefined) upsertPayload.marketing_spend_pct = body.marketing_spend_pct;
  if (body.launch_date !== undefined) upsertPayload.launch_date = body.launch_date;
  if (body.marketing_manager_user_id !== undefined) upsertPayload.marketing_manager_user_id = body.marketing_manager_user_id;

  if (isInsert) {
    upsertPayload.created_at = now;
  }

  const { data: upserted, error: upsertError } = await supabase
    .schema('mih')
    .from('projects')
    .upsert(upsertPayload, { onConflict: 'org_id,crm_project_id' })
    .select('id')
    .single();

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const projectId = (upserted as Record<string, string>).id;

  // Write project_stage_history on insert (if lifecycle_stage provided) or on stage change
  if (body.lifecycle_stage && (isInsert || lifecycleStageChanged)) {
    await supabase
      .schema('mih')
      .from('project_stage_history')
      .insert({
        org_id: orgId,
        project_id: projectId,
        lifecycle_stage: body.lifecycle_stage,
        previous_lifecycle_stage: isInsert ? null : previousLifecycleStage,
        occurred_at: now,
      });
  }

  return NextResponse.json({
    outcome: isInsert ? 'created' : 'updated',
    project_id: projectId,
  });
}
