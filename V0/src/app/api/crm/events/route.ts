import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  processEvent,
  verifyHmacSignature,
  verifyTimestamp,
  type CrmEventEnvelope,
  type CrmEventKind,
} from '@/modules/crm-events/inbox';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  const signatureHeader = req.headers.get('x-builtrix-signature') ?? '';
  const timestampHeader = req.headers.get('x-builtrix-timestamp') ?? '';
  const authHeader = req.headers.get('authorization') ?? '';

  // Timestamp replay guard (must be within 5 minutes)
  if (!timestampHeader || !verifyTimestamp(timestampHeader)) {
    return NextResponse.json({ ok: false, error: 'timestamp_invalid_or_expired' }, { status: 401 });
  }

  // Parse body
  let envelope: CrmEventEnvelope;
  try {
    envelope = JSON.parse(rawBody) as CrmEventEnvelope;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const { organization_id, event_id, event_kind } = envelope;

  if (!organization_id || !event_id || !event_kind) {
    return NextResponse.json(
      { ok: false, error: 'missing_required_fields: organization_id, event_id, event_kind' },
      { status: 400 },
    );
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_misconfigured' }, { status: 500 });
  }

  // Validate bearer token against org's stored token hash
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!bearerToken) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { data: orgRaw, error: orgError } = await supabase
    .from('organizations')
    .select('id, crm_hmac_secret_id')
    .eq('crm_organization_id', organization_id)
    .maybeSingle();

  if (orgError || !orgRaw) {
    return NextResponse.json({ ok: false, error: 'organization_not_found' }, { status: 401 });
  }

  const org = orgRaw as Record<string, unknown>;
  const orgId = org['id'] as string;

  // Load HMAC secret for signature verification
  const hmacSecretId = org['crm_hmac_secret_id'] as string | null;
  if (!hmacSecretId) {
    return NextResponse.json({ ok: false, error: 'hmac_not_configured' }, { status: 401 });
  }

  const { data: hmacCredRaw } = await supabase
    .from('credentials')
    .select('ciphertext')
    .eq('id', hmacSecretId)
    .single();

  if (!hmacCredRaw) {
    return NextResponse.json({ ok: false, error: 'hmac_secret_not_found' }, { status: 401 });
  }

  const hmacCred = hmacCredRaw as Record<string, string>;
  const hmacSecret = hmacCred['ciphertext'];

  // Verify HMAC signature
  if (!signatureHeader || !verifyHmacSignature(hmacSecret, timestampHeader, rawBody, signatureHeader)) {
    return NextResponse.json({ ok: false, error: 'signature_invalid' }, { status: 401 });
  }

  // Process the event
  try {
    const result = await processEvent(supabase, orgId, {
      ...envelope,
      event_kind: event_kind as CrmEventKind,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: result.status ?? 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('[CRM Events] processEvent error:', err);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
