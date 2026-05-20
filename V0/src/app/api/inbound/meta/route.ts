import { NextRequest, NextResponse } from 'next/server';
import { verifyMetaSignature, handleVerificationChallenge, parseLeadgenNotifications } from '@/modules/connectors/meta-lead-ads/webhook';
import type { MetaWebhookBody } from '@/modules/connectors/meta-lead-ads/types';
import { fetchLead } from '@/modules/connectors/meta-lead-ads/client';
import { normalizeMetaLead } from '@/modules/connectors/meta-lead-ads/normalizer';
import { ingest } from '@/modules/ingestion/index';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * GET /api/inbound/meta
 * Meta webhook subscription verification handshake.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  const { status, body } = handleVerificationChallenge(req.nextUrl.searchParams, verifyToken);
  return new NextResponse(body, { status });
}

/**
 * POST /api/inbound/meta
 * Receives Meta leadgen webhook events.
 * Returns 200 immediately (Meta retries on timeout >5s).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  // Read raw body for HMAC verification — must happen before any JSON parsing
  const rawBody = Buffer.from(await req.arrayBuffer());
  const signature = req.headers.get('x-hub-signature-256') ?? '';

  if (!verifyMetaSignature(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: MetaWebhookBody;
  try {
    body = JSON.parse(rawBody.toString('utf-8')) as MetaWebhookBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.object !== 'page') {
    // Non-leadgen webhook (e.g. page_feed) — acknowledge and ignore
    return NextResponse.json({ ok: true });
  }

  const notifications = parseLeadgenNotifications(body);

  // Fire-and-forget: process each leadgen notification asynchronously.
  // We return 200 before awaiting to stay within Meta's 5-second window.
  for (const n of notifications) {
    void processLeadgenNotification(n);
  }

  return NextResponse.json({ ok: true, queued: notifications.length });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeDlqEntry(
  supabase: SupabaseClient,
  orgId: string,
  sourceId: string,
  stage: string,
  payload: unknown,
  message: string,
): Promise<void> {
  await supabase.from('connector_dlq').insert({
    organization_id: orgId,
    source_id: sourceId,
    failure_stage: stage,
    raw_payload: payload,
    error_message: String(message),
  });
}

async function processLeadgenNotification(
  notification: Awaited<ReturnType<typeof parseLeadgenNotifications>>[number],
): Promise<void> {
  const supabase = getSupabaseAdmin();

  // 1. Find source by page_id
  const { data: source } = await supabase
    .from('sources')
    .select('id, organization_id, credential_id, config')
    .eq('source_kind', 'meta_lead_ads')
    .filter('config->>page_id', 'eq', notification.pageId)
    .maybeSingle() as { data: { id: string; organization_id: string; credential_id: string | null; config: Record<string, unknown> } | null };

  if (!source) {
    console.warn('[meta-webhook] no source found for page_id', notification.pageId);
    return;
  }

  // 2. Resolve access token
  // Credentials are stored as encrypted bytea (ciphertext + nonce).
  // Full decryption requires the server-side key — not available in V1 edge runtime.
  // Fall back to META_TEST_ACCESS_TOKEN for dev/testing; log a warning in prod.
  let accessToken = process.env.META_TEST_ACCESS_TOKEN ?? '';

  if (!accessToken && source.credential_id) {
    // TODO(M-008): wire symmetric decryption of ciphertext using CREDENTIALS_ENCRYPTION_KEY.
    console.warn(
      '[meta-webhook] credential decryption not yet implemented; set META_TEST_ACCESS_TOKEN for dev',
      { sourceId: source.id },
    );
  }

  if (!accessToken) {
    console.error('[meta-webhook] no access token available for source', source.id);
    await writeDlqEntry(
      supabase,
      source.organization_id,
      source.id,
      'fetch',
      { notification },
      'No access token available — set META_TEST_ACCESS_TOKEN or implement credential decryption',
    );
    return;
  }

  // 3. Fetch lead from Meta Graph API
  let leadData: Awaited<ReturnType<typeof fetchLead>>;
  try {
    leadData = await fetchLead(notification.leadgenId, accessToken);
  } catch (err) {
    console.error('[meta-webhook] failed to fetch lead from Meta API', err);
    await writeDlqEntry(
      supabase,
      source.organization_id,
      source.id,
      'fetch',
      { notification },
      String(err),
    );
    return;
  }

  // 4. Normalize Meta payload → RawLeadInput
  let rawLeadInput: ReturnType<typeof normalizeMetaLead>;
  try {
    rawLeadInput = normalizeMetaLead(leadData);
  } catch (err) {
    console.error('[meta-webhook] failed to normalize Meta lead', err);
    await writeDlqEntry(
      supabase,
      source.organization_id,
      source.id,
      'normalize',
      leadData,
      String(err),
    );
    return;
  }

  // 5. Ingest
  try {
    const result = await ingest(rawLeadInput, source.id, source.organization_id, {
      supabaseAdmin: supabase,
      writeDlq: async (row) =>
        writeDlqEntry(supabase, row.organization_id, row.source_id, row.failure_stage, row.raw_payload, row.error_message),
      requestId: crypto.randomUUID(),
    });
    console.log('[meta-webhook] ingest result', { leadgenId: notification.leadgenId, result });
  } catch (err) {
    console.error('[meta-webhook] ingest threw unexpectedly', err);
    await writeDlqEntry(
      supabase,
      source.organization_id,
      source.id,
      'ingest',
      rawLeadInput.rawPayload,
      String(err),
    );
  }
}
