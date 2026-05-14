import { createHmac, timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '@/inngest/client';

export type CrmEventKind =
  | 'lead.received'
  | 'lead.assigned'
  | 'lead.contacted'
  | 'lead.qualified'
  | 'lead.lost'
  | 'lead.junk'
  | 'lead.site_visit_scheduled'
  | 'lead.site_visit_completed'
  | 'deal.created'
  | 'deal.won'
  | 'deal.lost';

const VALID_KINDS = new Set<string>([
  'lead.received', 'lead.assigned', 'lead.contacted', 'lead.qualified',
  'lead.lost', 'lead.junk', 'lead.site_visit_scheduled', 'lead.site_visit_completed',
  'deal.created', 'deal.won', 'deal.lost',
]);

// Maps event_kind to lifecycle_state stored on unique_leads
const LIFECYCLE_STATE_MAP: Partial<Record<CrmEventKind, string>> = {
  'lead.received': 'received',
  'lead.assigned': 'assigned',
  'lead.contacted': 'contacted',
  'lead.qualified': 'qualified',
  'lead.lost': 'lost',
  'lead.junk': 'junk',
  'lead.site_visit_scheduled': 'site_visit_scheduled',
  'lead.site_visit_completed': 'site_visit_completed',
  'deal.created': 'deal_created',
  'deal.won': 'won',
  'deal.lost': 'deal_lost',
};

export type CrmEventEnvelope = {
  event_id: string;
  organization_id: string;
  event_kind: CrmEventKind;
  source_product: string;
  ts: string;
  payload: Record<string, unknown>;
};

export type ProcessEventResult =
  | { ok: true; event_id: string; status: 'processed' | 'deduped' }
  | { ok: false; error: string; status?: number };

export function verifyHmacSignature(
  hmacSecret: string,
  timestamp: string,
  body: string,
  signatureHeader: string,
): boolean {
  const expected = createHmac('sha256', hmacSecret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  const provided = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader;

  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch {
    return false;
  }
}

export function verifyTimestamp(timestamp: string, windowMs = 5 * 60_000): boolean {
  const ts = new Date(timestamp).getTime();
  if (isNaN(ts)) return false;
  return Math.abs(Date.now() - ts) <= windowMs;
}

export async function processEvent(
  supabaseAdmin: SupabaseClient,
  orgId: string,
  envelope: CrmEventEnvelope,
): Promise<ProcessEventResult> {
  const { event_id, event_kind, payload } = envelope;

  if (!VALID_KINDS.has(event_kind)) {
    return { ok: false, error: `Unknown event_kind: ${event_kind}`, status: 400 };
  }

  // Idempotency check
  const { data: existing } = await supabaseAdmin
    .from('crm_lifecycle_events')
    .select('id')
    .eq('organization_id', orgId)
    .eq('event_id', event_id)
    .maybeSingle();

  if (existing) {
    return { ok: true, event_id, status: 'deduped' };
  }

  // Look up unique_lead via external_id from payload
  const externalId = (payload.external_id as string) ?? null;
  let mihUniqueLeadId: string | null = null;

  if (externalId) {
    const { data: lead } = await supabaseAdmin
      .from('unique_leads')
      .select('id')
      .eq('organization_id', orgId)
      .eq('crm_external_id', externalId)
      .maybeSingle();

    mihUniqueLeadId = (lead?.id as string) ?? null;
  }

  // Insert event (immutable)
  const { error: insertError } = await supabaseAdmin.from('crm_lifecycle_events').insert({
    organization_id: orgId,
    event_id,
    mih_unique_lead_id: mihUniqueLeadId,
    crm_lead_id: (payload.lead_id as string) ?? null,
    crm_external_id: externalId,
    event_kind,
    source_product: envelope.source_product ?? 'ai_crm',
    event_payload: payload,
    received_at: envelope.ts ?? new Date().toISOString(),
  });

  if (insertError) {
    // Handle race: another request inserted same event_id
    if (insertError.code === '23505') {
      return { ok: true, event_id, status: 'deduped' };
    }
    throw new Error(`crm_lifecycle_events insert failed: ${insertError.message}`);
  }

  // Update unique_lead lifecycle state
  const lifecycleState = LIFECYCLE_STATE_MAP[event_kind];
  if (mihUniqueLeadId && lifecycleState) {
    await supabaseAdmin
      .from('unique_leads')
      .update({
        last_lifecycle_state: lifecycleState,
        last_lifecycle_at: envelope.ts ?? new Date().toISOString(),
      })
      .eq('id', mihUniqueLeadId);
  }

  // Audit log
  await supabaseAdmin.from('audit_log').insert({
    organization_id: orgId,
    actor_type: 'system',
    action: `crm_event.${event_kind}`,
    table_name: 'crm_lifecycle_events',
    record_id: event_id,
    request_id: crypto.randomUUID(),
    after_state: { event_kind, mih_unique_lead_id: mihUniqueLeadId, crm_external_id: externalId },
  });

  // Fire Inngest event for downstream processing
  await inngest.send({
    name: 'mih/crm.event_received',
    data: {
      event_id,
      event_kind,
      unique_lead_id: mihUniqueLeadId,
      org_id: orgId,
    },
  });

  return { ok: true, event_id, status: 'processed' };
}
