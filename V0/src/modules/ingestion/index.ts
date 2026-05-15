import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone, normalizeEmail, normalizeName, PhoneNormalizationError } from './normalize';
import { computePayloadHash } from './hash';
import { validateRawLeadInput, ValidationError } from './validate';
import type { RawLeadInput } from '../connectors/_kernel/types';

export { computePayloadHash } from './hash';
export { normalizePhone, normalizeEmail, normalizeName } from './normalize';
export { validateRawLeadInput, ValidationError } from './validate';

export type IngestDeps = {
  supabaseAdmin: SupabaseClient;
  /** Fire Inngest event mih/lead.ingested — wired in M-005 Inngest handler */
  emitLeadIngested?: (rawLeadId: string, orgId: string, requestId: string) => Promise<void>;
  /** Write a DLQ row on normalization/validation failure */
  writeDlq?: (row: {
    organization_id: string;
    source_id: string;
    failure_stage: string;
    raw_payload: unknown;
    error_message: string;
  }) => Promise<void>;
  requestId?: string;
};

export type IngestResult =
  | { status: 'inserted'; rawLeadId: string }
  | { status: 'duplicate_external_id' }
  | { status: 'duplicate_hash' }
  | { status: 'validation_error'; message: string }
  | { status: 'normalize_error'; message: string };

/**
 * Single entry point for all lead ingestion regardless of source.
 * Idempotent: returns existing status if the lead was already seen.
 */
export async function ingest(
  input: RawLeadInput,
  sourceId: string,
  organizationId: string,
  deps: IngestDeps,
): Promise<IngestResult> {
  const requestId = deps.requestId ?? crypto.randomUUID();

  // 1. Normalize phone
  let phoneE164: string;
  try {
    phoneE164 = normalizePhone(input.phoneE164);
  } catch (err) {
    await deps.writeDlq?.({
      organization_id: organizationId,
      source_id: sourceId,
      failure_stage: 'normalize',
      raw_payload: input.rawPayload,
      error_message: (err as Error).message,
    });
    return { status: 'normalize_error', message: (err as Error).message };
  }

  // 2. Normalize other fields
  const email = normalizeEmail(input.email);
  const name = normalizeName(input.name);

  // 3. Validate
  try {
    validateRawLeadInput({ ...input, phoneE164, email, name });
  } catch (err) {
    if (err instanceof ValidationError) {
      await deps.writeDlq?.({
        organization_id: organizationId,
        source_id: sourceId,
        failure_stage: 'normalize',
        raw_payload: input.rawPayload,
        error_message: err.message,
      });
      return { status: 'validation_error', message: err.message };
    }
    throw err;
  }

  // 4. Compute payload hash
  const payloadHash = computePayloadHash({
    sourceId,
    phoneE164,
    email,
    name,
    sourceReceivedAt: input.sourceReceivedAt,
  });

  // 5. Insert raw_lead (UPSERT with ON CONFLICT DO NOTHING for idempotency)
  const row = {
    organization_id: organizationId,
    source_id: sourceId,
    source_external_id: input.sourceExternalId,
    phone_e164: phoneE164,
    email: email ?? null,
    name,
    source_campaign_id: input.sourceCampaignId ?? null,
    source_campaign_name: input.sourceCampaignName ?? null,
    source_ad_id: input.sourceAdId ?? null,
    source_ad_name: input.sourceAdName ?? null,
    source_creative_id: input.sourceCreativeId ?? null,
    source_keyword: input.sourceKeyword ?? null,
    source_referrer_url: input.sourceReferrerUrl ?? null,
    source_received_at: input.sourceReceivedAt.toISOString(),
    payload_hash: payloadHash,
    raw_payload: input.rawPayload as object,
    dedup_status: 'pending',
  };

  const { data, error } = await deps.supabaseAdmin
    .from('raw_leads')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    // Unique constraint on (source_id, source_external_id)
    if (error.code === '23505' && error.message.includes('source_external_id')) {
      return { status: 'duplicate_external_id' };
    }
    // Unique constraint on (organization_id, payload_hash)
    if (error.code === '23505' && error.message.includes('payload_hash')) {
      return { status: 'duplicate_hash' };
    }
    throw new Error(`raw_leads insert failed: ${error.message}`);
  }

  const rawLeadId = data.id as string;

  // 6. Audit log
  await deps.supabaseAdmin.from('audit_log').insert({
    organization_id: organizationId,
    actor_type: 'connector',
    action: 'raw_lead.ingested',
    table_name: 'raw_leads',
    record_id: rawLeadId,
    request_id: requestId,
    after_state: { source_id: sourceId, phone_e164: phoneE164, payload_hash: payloadHash },
  });

  // 7. Emit Inngest event (stubbed until Inngest client wired)
  await deps.emitLeadIngested?.(rawLeadId, organizationId, requestId);

  return { status: 'inserted', rawLeadId };
}
