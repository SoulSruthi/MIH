import { inngest } from '@/inngest/client';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { buildCrmPayload } from './builder';
import { postLeadToCrm, CrmHttpError } from './client';
import { guardCrmUrl, SsrfError } from './dns-guard';
import { getCircuitState, recordSuccess, recordFailure, CircuitOpenError } from './circuit-breaker';

// Retry delay schedule (ms) — attempt index 0-based
const RETRY_DELAYS_MS = [0, 1_000, 5_000, 30_000, 300_000, 1_800_000, 7_200_000, 43_200_000];
const MAX_ATTEMPTS = 8;

export const crmHandoffFunction = inngest.createFunction(
  {
    id: 'crm-handoff',
    name: 'CRM Handoff Worker',
    triggers: [{ event: 'mih/lead.dedup_decided' as string }],
  },
  async ({ event, step }: { event: { data: { unique_lead_id: string; dedup_status: string; org_id: string } }; step: { run: <T>(id: string, fn: () => Promise<T>) => Promise<T>; sleep: (id: string, ms: number) => Promise<void> } }) => {
    const { unique_lead_id, dedup_status, org_id } = event.data;

    // Only process unique leads
    if (dedup_status !== 'unique') return { skipped: true, reason: 'duplicate' };

    const supabase = getSupabaseAdmin();

    // Load unique lead + org CRM config
    const leadData = await step.run('load-lead', async () => {
      const { data, error } = await supabase
        .from('unique_leads')
        .select('id, crm_external_id, primary_phone_e164, primary_email, primary_name, first_seen_at, primary_source_id, touch_sources, preference_bhk, preference_budget_band, preference_location, mih_intent_score, mih_quality_grade, crm_handoff_status')
        .eq('id', unique_lead_id)
        .single();

      if (error) throw new Error(`Failed to load unique_lead: ${error.message}`);
      return data as Record<string, unknown>;
    });

    // Already succeeded — idempotency guard
    if (leadData['crm_handoff_status'] === 'succeeded') return { skipped: true, reason: 'already_succeeded' };

    const orgData = await step.run('load-org', async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, crm_organization_id, crm_base_url, crm_api_token_id, crm_hmac_secret_id')
        .eq('id', org_id)
        .single();

      if (error) throw new Error(`Failed to load org: ${error.message}`);
      return data as Record<string, unknown>;
    });

    const crmBaseUrl = (orgData['crm_base_url'] as string) ?? 'https://crm.builtrix.io';
    const crmOrgId = orgData['crm_organization_id'] as string;

    // SSRF guard
    await step.run('ssrf-guard', async () => {
      try {
        await guardCrmUrl(crmBaseUrl);
      } catch (e) {
        if (e instanceof SsrfError) {
          await supabase.from('audit_log').insert({
            organization_id: org_id,
            actor_type: 'system',
            action: 'crm_handoff.ssrf_rejected',
            table_name: 'unique_leads',
            record_id: unique_lead_id,
            request_id: crypto.randomUUID(),
            after_state: { crm_base_url: crmBaseUrl, error: e.message },
          } as never);
          throw e;
        }
        throw e;
      }
    });

    // Decrypt credentials
    const creds = await step.run('load-credentials', async () => {
      const tokenId = orgData['crm_api_token_id'] as string | null;
      const hmacId = orgData['crm_hmac_secret_id'] as string | null;
      if (!tokenId || !hmacId) throw new Error('CRM credentials not configured for org');

      const { data: tokenRow } = await supabase
        .from('credentials')
        .select('ciphertext, nonce')
        .eq('id', tokenId)
        .single();

      const { data: hmacRow } = await supabase
        .from('credentials')
        .select('ciphertext, nonce')
        .eq('id', hmacId)
        .single();

      const tr = tokenRow as Record<string, string> | null;
      const hr = hmacRow as Record<string, string> | null;

      if (!tr || !hr) throw new Error('CRM credential rows not found');
      return { bearerToken: tr['ciphertext'], hmacSecret: hr['ciphertext'] };
    });

    // Load source info
    const sourceData = await step.run('load-source', async () => {
      const { data, error } = await supabase
        .from('sources')
        .select('source_type, name')
        .eq('id', leadData['primary_source_id'] as string)
        .single();

      if (error) throw new Error(`Failed to load source: ${error.message}`);
      return data as Record<string, string>;
    });

    // Load first raw lead for campaign context
    const primaryRawLead = await step.run('load-raw-lead', async () => {
      const touchSources = (leadData['touch_sources'] as { raw_lead_id: string }[]) ?? [];
      if (touchSources.length === 0) return null;
      const { data } = await supabase
        .from('raw_leads')
        .select('source_campaign_id, source_campaign_name, source_ad_id, source_ad_name, payload')
        .eq('id', touchSources[0].raw_lead_id)
        .maybeSingle();
      return data as Record<string, unknown> | null;
    });

    // Build CRM payload
    const crmPayload = buildCrmPayload(
      leadData as Parameters<typeof buildCrmPayload>[0],
      sourceData as Parameters<typeof buildCrmPayload>[1],
      crmOrgId,
      primaryRawLead as Parameters<typeof buildCrmPayload>[3],
    );

    // Update status to queued
    await step.run('mark-queued', async () => {
      await supabase
        .from('unique_leads')
        .update({ crm_handoff_status: 'queued' } as never)
        .eq('id', unique_lead_id);
    });

    // Attempt loop with retries
    let finalSuccess = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        const delayMs = RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        await step.sleep(`retry-delay-${attempt}`, delayMs);
      }

      const result = await step.run(`attempt-${attempt}`, async () => {
        const circuitState = await getCircuitState(supabase, org_id);
        if (circuitState === 'open') throw new CircuitOpenError(org_id);

        const deliveryId = crypto.randomUUID();
        let httpStatus: number | null = null;
        let responseBody = '';
        let errorMessage = '';

        await supabase.from('outbound_deliveries').insert({
          id: deliveryId,
          organization_id: org_id,
          unique_lead_id,
          endpoint_url: `${crmBaseUrl}/api/sister/v1/leads`,
          idempotency_key: crmPayload.external_id,
          attempt_number: attempt,
          status: 'in_flight',
        } as never);

        try {
          const crmResponse = await postLeadToCrm(crmPayload, {
            baseUrl: crmBaseUrl,
            bearerToken: creds.bearerToken,
            hmacSecret: creds.hmacSecret,
          });

          httpStatus = 201;
          responseBody = JSON.stringify(crmResponse).slice(0, 500);

          await supabase
            .from('unique_leads')
            .update({ crm_handoff_status: 'succeeded', crm_lead_id: crmResponse.lead_id, crm_handoff_at: new Date().toISOString() } as never)
            .eq('id', unique_lead_id);

          await supabase
            .from('outbound_deliveries')
            .update({ status: 'succeeded', http_status: httpStatus, response_body: responseBody } as never)
            .eq('id', deliveryId);

          await recordSuccess(supabase, org_id, crmBaseUrl);
          return { success: true, permanent: false, crmLeadId: crmResponse.lead_id };
        } catch (err) {
          if (err instanceof CrmHttpError) {
            httpStatus = err.status;
            responseBody = err.message.slice(0, 500);
            errorMessage = err.message;

            if (!err.retryable) {
              await supabase.from('unique_leads').update({ crm_handoff_status: 'failed' } as never).eq('id', unique_lead_id);
              await supabase.from('outbound_deliveries').update({ status: 'failed', http_status: httpStatus, response_body: responseBody, error_message: errorMessage } as never).eq('id', deliveryId);
              await recordFailure(supabase, org_id, crmBaseUrl);
              return { success: false, permanent: true };
            }

            const nextRetry = attempt < MAX_ATTEMPTS ? new Date(Date.now() + (RETRY_DELAYS_MS[attempt] ?? 43_200_000)) : null;
            await supabase.from('outbound_deliveries').update({ status: 'failed', http_status: httpStatus, response_body: responseBody, error_message: errorMessage, next_retry_at: nextRetry?.toISOString() ?? null } as never).eq('id', deliveryId);

            const { opened } = await recordFailure(supabase, org_id, crmBaseUrl);
            if (opened) {
              await supabase.from('audit_log').insert({ organization_id: org_id, actor_type: 'system', action: 'crm_circuit_breaker.opened', table_name: 'crm_circuit_breaker', record_id: org_id, request_id: crypto.randomUUID(), after_state: { crm_base_url: crmBaseUrl } } as never);
            }
            return { success: false, permanent: false };
          }

          errorMessage = (err as Error).message;
          await supabase.from('outbound_deliveries').update({ status: 'failed', error_message: errorMessage.slice(0, 500) } as never).eq('id', deliveryId);
          return { success: false, permanent: false };
        }
      });

      if (result.success) { finalSuccess = true; break; }
      if (result.permanent) break;
    }

    // After all attempts exhausted — write DLQ if not succeeded
    await step.run('check-dlq', async () => {
      if (!finalSuccess) {
        const { data: lead } = await supabase.from('unique_leads').select('crm_handoff_status').eq('id', unique_lead_id).single();
        const leadRow = lead as Record<string, string> | null;
        if (leadRow?.['crm_handoff_status'] !== 'succeeded') {
          await supabase.from('unique_leads').update({ crm_handoff_status: 'failed' } as never).eq('id', unique_lead_id);
          await supabase.from('connector_dlq').insert({ organization_id: org_id, source_id: leadData['primary_source_id'], failure_stage: 'crm_handoff', raw_payload: { unique_lead_id, crm_external_id: leadData['crm_external_id'] }, error_message: 'All 8 CRM handoff attempts failed', retry_count: MAX_ATTEMPTS } as never);
        }
      }
    });

    return { done: true, succeeded: finalSuccess };
  },
);
