import type { SupabaseClient } from '@supabase/supabase-js';
import type { PortalKind } from './types.js';
import { parsePortalWebhookPayload } from './webhook.js';
import { normalizePortalLead } from './normalizer.js';
import { ingest } from '../../ingestion/index.js';

export type PortalWebhookResult = {
  accepted: number;
  failed: number;
};

/**
 * Parse, normalize, and ingest one or more portal webhook payloads.
 * Portals may POST a single lead object or an array of lead objects.
 */
export async function ingestPortalWebhook(
  supabase: SupabaseClient,
  kind: PortalKind,
  orgId: string,
  sourceId: string,
  rawBody: unknown,
): Promise<PortalWebhookResult> {
  const bodyArr = Array.isArray(rawBody) ? rawBody : [rawBody];
  let accepted = 0;
  let failed = 0;

  for (const item of bodyArr) {
    const body = item as Record<string, unknown>;
    try {
      const portalLead = parsePortalWebhookPayload(kind, body);
      const rawLeadInput = normalizePortalLead(portalLead);
      const result = await ingest(rawLeadInput, sourceId, orgId, {
        supabaseAdmin: supabase,
        writeDlq: async (row) => {
          await supabase.from('connector_dlq').insert({
            organization_id: row.organization_id,
            source_id: row.source_id,
            failure_stage: row.failure_stage,
            raw_payload: row.raw_payload,
            error_message: row.error_message,
          });
        },
        requestId: crypto.randomUUID(),
      });

      if (
        result.status === 'inserted' ||
        result.status === 'duplicate_external_id' ||
        result.status === 'duplicate_hash'
      ) {
        accepted++;
      } else {
        failed++;
      }
    } catch (err) {
      failed++;
      await supabase.from('connector_dlq').insert({
        organization_id: orgId,
        source_id: sourceId,
        failure_stage: 'normalize',
        raw_payload: body,
        error_message: String(err),
      });
    }
  }

  return { accepted, failed };
}
