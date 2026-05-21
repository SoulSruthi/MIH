import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { inngest } from '@/inngest/client';

const CP_PUSH_CONNECTOR_ID = 'crm_integration';

type CpPushBody = {
  crm_event_id: string;
  channel_partner_code: string;
  cluster_id?: string;
  lead_name?: string;
  lead_phone?: string;
  lead_email?: string;
  project_id?: string;
  [key: string]: unknown;
};

type CrmConfig = { hmac_secret?: string };
type ConfigRow = { config: Record<string, unknown> | null };

function verifyHmacSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const rawBody = Buffer.from(await req.arrayBuffer());
  const supabase = getSupabaseAdmin();

  // Load CRM config for HMAC secret
  const { data: configRow } = await supabase
    .from('org_connector_configs')
    .select('config')
    .eq('organization_id', orgId)
    .eq('connector_id', CP_PUSH_CONNECTOR_ID)
    .maybeSingle() as unknown as { data: ConfigRow | null; error: { message: string } | null };

  const crmConfig = (configRow?.config ?? {}) as CrmConfig;
  const hmacSecret = crmConfig.hmac_secret;

  if (hmacSecret) {
    const signature = req.headers.get('x-mih-signature') ?? '';
    if (!verifyHmacSignature(rawBody, signature, hmacSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let body: CpPushBody;
  try {
    body = JSON.parse(rawBody.toString('utf-8')) as CpPushBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.crm_event_id || !body.channel_partner_code) {
    return NextResponse.json(
      { error: 'crm_event_id and channel_partner_code are required' },
      { status: 400 },
    );
  }

  // Resolve channel partner by code
  const { data: cp, error: cpError } = await supabase
    .schema('mih')
    .from('channel_partners')
    .select('id')
    .eq('org_id', orgId)
    .eq('code', body.channel_partner_code)
    .eq('is_active', true)
    .maybeSingle();

  if (cpError) return NextResponse.json({ error: cpError.message }, { status: 500 });
  if (!cp) {
    return NextResponse.json(
      { error: `No active channel partner with code '${body.channel_partner_code}'` },
      { status: 404 },
    );
  }

  // Idempotency: check if already processed
  const { data: existing } = await supabase
    .schema('mih')
    .from('cp_push_events')
    .select('id')
    .eq('org_id', orgId)
    .eq('crm_event_id', body.crm_event_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true, push_event_id: existing.id });
  }

  const { raw_payload, crm_event_id, channel_partner_code, cluster_id, lead_name, lead_phone, lead_email, project_id, ...rest } = body;

  const { data: pushEvent, error: insertError } = await supabase
    .schema('mih')
    .from('cp_push_events')
    .insert({
      org_id: orgId,
      channel_partner_id: cp.id,
      crm_event_id: body.crm_event_id,
      cluster_id: body.cluster_id ?? null,
      lead_name: body.lead_name ?? null,
      lead_phone: body.lead_phone ?? null,
      lead_email: body.lead_email ?? null,
      project_id: body.project_id ?? null,
      raw_payload: rest,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Fire Inngest event for downstream processing
  await inngest.send({
    name: 'cp/push.received',
    data: {
      org_id: orgId,
      push_event_id: pushEvent.id,
      channel_partner_id: cp.id,
      cluster_id: body.cluster_id ?? null,
    },
  });

  return NextResponse.json({ ok: true, push_event_id: pushEvent.id }, { status: 201 });
}
