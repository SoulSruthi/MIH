import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function verifyHmac(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  return signature === expected;
}

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

  let body: {
    crm_event_id?: string;
    event_kind?: string;
    cluster_id?: string;
    phone?: string;
    project_id?: string;
    source_id?: string;
    is_fast_track?: boolean;
    is_walk_in?: boolean;
    cab_booked?: boolean;
    scheduled_at?: string;
    completed_at?: string;
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.crm_event_id || !body.event_kind) {
    return NextResponse.json({ error: 'crm_event_id and event_kind are required' }, { status: 400 });
  }

  // Unmatched walk-in with no cluster_id
  if (body.event_kind === 'walk_in_unscheduled' && !body.cluster_id) {
    return NextResponse.json({ outcome: 'unmatched_walk_in' });
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }

  // Idempotency check
  const { data: existing } = await supabase
    .schema('mih')
    .from('site_visit_events')
    .select('id')
    .eq('org_id', orgId)
    .eq('crm_event_id', body.crm_event_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ outcome: 'duplicate', site_visit_event_id: existing.id });
  }

  const { data: siteVisit, error: svError } = await supabase
    .schema('mih')
    .from('site_visit_events')
    .insert({
      org_id: orgId,
      crm_event_id: body.crm_event_id,
      event_kind: body.event_kind,
      cluster_id: body.cluster_id ?? null,
      phone: body.phone ?? null,
      project_id: body.project_id ?? null,
      source_id: body.source_id ?? null,
      is_fast_track: body.is_fast_track ?? false,
      is_walk_in: body.is_walk_in ?? false,
      cab_booked: body.cab_booked ?? false,
      scheduled_at: body.scheduled_at ?? null,
      completed_at: body.completed_at ?? null,
    })
    .select()
    .single();

  if (svError) return NextResponse.json({ error: svError.message }, { status: 500 });

  // Insert conversion event for 'scheduled' or 'completed' events with a cluster
  if (body.cluster_id && (body.event_kind === 'scheduled' || body.event_kind === 'completed')) {
    const occurredAt =
      body.event_kind === 'completed'
        ? (body.completed_at ?? new Date().toISOString())
        : (body.scheduled_at ?? new Date().toISOString());

    await supabase
      .schema('mih')
      .from('conversion_events')
      .insert({
        org_id: orgId,
        cluster_id: body.cluster_id,
        event_code: `site_visit_${body.event_kind}`,
        project_id: body.project_id ?? null,
        deal_value_paise: null,
        occurred_at: occurredAt,
        crm_event_id: body.crm_event_id,
      });
  }

  return NextResponse.json({ outcome: 'created', site_visit_event_id: siteVisit.id });
}
