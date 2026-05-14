import { NextRequest, NextResponse } from 'next/server';
import { verifyMetaSignature, handleVerificationChallenge, parseLeadgenNotifications } from '@/modules/connectors/meta-lead-ads/webhook';
import type { MetaWebhookBody } from '@/modules/connectors/meta-lead-ads/types';

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

  // Fire-and-forget: enqueue each leadgen_id for async processing.
  // The actual lead fetch + ingest happens in the Inngest handler (M-005).
  // We return 200 before awaiting to stay within Meta's 5-second window.
  if (notifications.length > 0) {
    void enqueueLeadgenEvents(notifications);
  }

  return NextResponse.json({ ok: true, queued: notifications.length });
}

async function enqueueLeadgenEvents(
  notifications: Awaited<ReturnType<typeof parseLeadgenNotifications>>,
): Promise<void> {
  // Inngest event dispatch wired in M-005 (ingestion pipeline).
  // Stub: log to console until Inngest client is available.
  for (const n of notifications) {
    console.log('[meta-webhook] leadgen received', { leadgenId: n.leadgenId, pageId: n.pageId });
  }
}
