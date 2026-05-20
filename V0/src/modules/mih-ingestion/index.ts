/**
 * MIH Ingestion Module — ingest leads into mih.raw_inbox
 * alongside the existing raw_leads table (which continues to work).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhoneE164, normalizeEmail, normalizeName, PhoneNormalizationError } from './normalize';

export { normalizePhoneE164, normalizeEmail, normalizeName, PhoneNormalizationError };

export type MihIngestInput = {
  /** Raw phone string — will be normalized to E.164 */
  phone: string;
  email?: string | null;
  name?: string | null;
  /** Connector-assigned external ID (for idempotency) */
  externalId?: string | null;
  /** When the source platform received the lead */
  sourceReceivedAt?: Date | null;
  /** The mih.connectors.id that received this lead */
  connectorId?: string | null;
  /** The mih.sources.id for this lead */
  sourceId?: string | null;
  /** Optional mih.activities.id (for BTL) */
  activityId?: string | null;
  /** Optional project_id */
  projectId?: string | null;
  /** Ingestion path */
  ingestionPath: 'webhook' | 'pull' | 'webform' | 'csv' | 'manual' | 'cp_api' | 'phone_inbound';
  /** Raw payload from the source */
  rawPayload: Record<string, unknown>;
  /** Whether the signature was verified */
  signatureVerified?: boolean | null;
};

export type MihIngestResult =
  | { status: 'inserted'; rawInboxId: string }
  | { status: 'duplicate_external_id'; rawInboxId: string }
  | { status: 'validation_error'; message: string }
  | { status: 'normalize_error'; message: string };

export type MihIngestDeps = {
  supabaseAdmin: SupabaseClient;
  /** Emit event after successful ingestion */
  emitLeadIngested?: (rawInboxId: string, orgId: string) => Promise<void>;
};

/**
 * Ingest a raw lead into mih.raw_inbox.
 * Idempotent: if (org_id, connector_id, external_id) already exists, returns duplicate status.
 */
export async function mihIngest(
  input: MihIngestInput,
  orgId: string,
  deps: MihIngestDeps,
): Promise<MihIngestResult> {
  // 1. Normalize phone
  let phoneE164: string;
  try {
    phoneE164 = normalizePhoneE164(input.phone);
  } catch (err) {
    return { status: 'normalize_error', message: (err as Error).message };
  }

  // 2. Validate phone present
  if (!phoneE164) {
    return { status: 'validation_error', message: 'phone is required' };
  }

  // 3. Normalize other fields
  const email = normalizeEmail(input.email);
  const name = normalizeName(input.name);

  // 4. Build normalized payload
  const normalized = {
    phone_e164: phoneE164,
    email,
    name,
  };

  // 5. Insert into mih.raw_inbox
  const row = {
    org_id: orgId,
    connector_id: input.connectorId ?? null,
    source_id: input.sourceId ?? null,
    activity_id: input.activityId ?? null,
    project_id: input.projectId ?? null,
    ingestion_path: input.ingestionPath,
    external_id: input.externalId ?? null,
    received_at: new Date().toISOString(),
    source_received_at: input.sourceReceivedAt?.toISOString() ?? null,
    raw_payload: input.rawPayload,
    normalized,
    signature_verified: input.signatureVerified ?? null,
    processing_state: 'pending' as const,
  };

  const { data, error } = await deps.supabaseAdmin
    .schema('mih')
    .from('raw_inbox')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    // Unique constraint on (org_id, connector_id, external_id)
    if (error.code === '23505') {
      // Look up the existing row
      const existing = await deps.supabaseAdmin
        .schema('mih')
        .from('raw_inbox')
        .select('id')
        .eq('org_id', orgId)
        .eq('connector_id', input.connectorId ?? '')
        .eq('external_id', input.externalId ?? '')
        .single();
      return {
        status: 'duplicate_external_id',
        rawInboxId: existing.data?.id ?? '',
      };
    }
    throw new Error(`mih.raw_inbox insert failed: ${error.message}`);
  }

  const rawInboxId = (data as { id: string }).id;

  // 6. Emit event
  await deps.emitLeadIngested?.(rawInboxId, orgId);

  return { status: 'inserted', rawInboxId };
}
