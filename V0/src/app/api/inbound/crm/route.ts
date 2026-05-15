import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin.js';
import { normalizePhoneE164 } from '@/modules/connectors/_kernel/normalizer.js';

const CRM_CONNECTOR_ID = 'crm_integration';

type CrmWebhookBody = {
  phone: string;
  event_type: string;
  event_at: string;
  actor_id?: string;
  metadata?: Record<string, unknown>;
};

type CrmConfig = {
  hmac_secret?: string;
};

type UniqueLead = {
  id: string;
};

// Valid event types from migration 009
const VALID_EVENT_TYPES = new Set([
  'contacted',
  'qualified',
  'site_visit',
  'deal',
  'won',
  'lost',
  'dropped',
]);

function verifyHmacSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  // Constant-time comparison
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

  // Load CRM config to get HMAC secret
  const { data: configRow } = await supabase
    .from('org_connector_configs')
    .select('config')
    .eq('organization_id', orgId)
    .eq('connector_id', CRM_CONNECTOR_ID)
    .maybeSingle();

  const crmConfig = (configRow?.config ?? {}) as CrmConfig;
  const hmacSecret = crmConfig.hmac_secret;

  // Verify HMAC signature if secret is configured
  if (hmacSecret) {
    const signature = req.headers.get('x-hub-signature-256') ?? '';
    if (!verifyHmacSignature(rawBody, signature, hmacSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let body: CrmWebhookBody;
  try {
    body = JSON.parse(rawBody.toString('utf-8')) as CrmWebhookBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.phone || !body.event_type || !body.event_at) {
    return NextResponse.json(
      { error: 'phone, event_type, and event_at are required' },
      { status: 400 },
    );
  }

  if (!VALID_EVENT_TYPES.has(body.event_type)) {
    return NextResponse.json(
      { error: `Invalid event_type. Must be one of: ${[...VALID_EVENT_TYPES].join(', ')}` },
      { status: 400 },
    );
  }

  // Normalize phone to E.164
  let phoneE164: string;
  try {
    phoneE164 = normalizePhoneE164(body.phone.trim());
  } catch {
    return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
  }

  // Look up unique_leads by phone_e164 and org
  const { data: lead, error: leadError } = await supabase
    .from('unique_leads')
    .select('id')
    .eq('organization_id', orgId)
    .eq('primary_phone_e164', phoneE164)
    .maybeSingle() as { data: UniqueLead | null; error: { message: string } | null };

  if (leadError) {
    return NextResponse.json({ error: leadError.message }, { status: 500 });
  }

  if (!lead) {
    return NextResponse.json(
      { error: `No lead found for phone ${phoneE164} in this organization` },
      { status: 404 },
    );
  }

  // Insert lifecycle event
  const { error: insertError } = await supabase.from('crm_lifecycle_events').insert({
    organization_id: orgId,
    unique_lead_id: lead.id,
    event_type: body.event_type,
    event_at: body.event_at,
    crm_external_id: body.actor_id ?? null,
    raw_payload: body.metadata ?? null,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
