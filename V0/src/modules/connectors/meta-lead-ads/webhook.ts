import { verifyHmacSignature } from '../_kernel/hmac';
import type { MetaWebhookBody, MetaLeadgenNotification } from './types';

/**
 * Verifies the X-Hub-Signature-256 header from Meta.
 * Meta sends: "sha256=<hex>"
 */
export function verifyMetaSignature(
  rawBody: Buffer,
  signatureHeader: string,
  appSecret: string,
): boolean {
  return verifyHmacSignature(rawBody, appSecret, signatureHeader);
}

/**
 * Handles GET /api/inbound/meta — Meta webhook subscription verification.
 * Meta sends: hub.mode=subscribe, hub.verify_token, hub.challenge
 */
export function handleVerificationChallenge(
  params: URLSearchParams,
  verifyToken: string,
): { status: number; body: string } {
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return { status: 200, body: challenge };
  }
  return { status: 403, body: 'Forbidden' };
}

/**
 * Parses a Meta leadgen webhook body into structured notifications.
 * Returns empty array if no leadgen changes found (e.g. page_feed event).
 */
export function parseLeadgenNotifications(body: MetaWebhookBody): MetaLeadgenNotification[] {
  const notifications: MetaLeadgenNotification[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue;
      const v = change.value;
      notifications.push({
        leadgenId: v.leadgen_id,
        pageId: v.page_id,
        formId: v.form_id,
        adId: v.ad_id,
        createdTime: new Date(v.created_time * 1000),
      });
    }
  }

  return notifications;
}
