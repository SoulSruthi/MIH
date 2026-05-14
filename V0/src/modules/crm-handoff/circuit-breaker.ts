import type { SupabaseClient } from '@supabase/supabase-js';

const FAILURE_THRESHOLD = 5;        // consecutive 5xx before opening
const FAILURE_WINDOW_MS = 60_000;   // 1 minute window
const COOLDOWN_MS = 5 * 60_000;     // 5 min before half-open

export type CircuitState = 'closed' | 'open' | 'half_open';

export class CircuitOpenError extends Error {
  constructor(public readonly orgId: string) {
    super(`Circuit breaker is OPEN for org ${orgId} — CRM unavailable`);
    this.name = 'CircuitOpenError';
  }
}

export async function getCircuitState(
  supabaseAdmin: SupabaseClient,
  orgId: string,
): Promise<CircuitState> {
  const { data } = await supabaseAdmin
    .from('crm_circuit_breaker')
    .select('state, close_after')
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!data) return 'closed';

  if (data.state === 'open' && data.close_after) {
    if (new Date(data.close_after as string) <= new Date()) {
      // Transition to half_open so next attempt is a probe
      await supabaseAdmin
        .from('crm_circuit_breaker')
        .update({ state: 'half_open' })
        .eq('organization_id', orgId);
      return 'half_open';
    }
  }

  return data.state as CircuitState;
}

export async function recordSuccess(
  supabaseAdmin: SupabaseClient,
  orgId: string,
  crmBaseUrl: string,
): Promise<void> {
  const { data } = await supabaseAdmin
    .from('crm_circuit_breaker')
    .select('id')
    .eq('organization_id', orgId)
    .maybeSingle();

  if (data) {
    await supabaseAdmin
      .from('crm_circuit_breaker')
      .update({ state: 'closed', consecutive_failures: 0, opened_at: null, close_after: null })
      .eq('organization_id', orgId);
  }
  // No row = already closed; nothing to do
  void crmBaseUrl;
}

export async function recordFailure(
  supabaseAdmin: SupabaseClient,
  orgId: string,
  crmBaseUrl: string,
): Promise<{ opened: boolean }> {
  const now = new Date();

  const { data: existing } = await supabaseAdmin
    .from('crm_circuit_breaker')
    .select('id, consecutive_failures, opened_at, state')
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!existing) {
    // First failure row
    await supabaseAdmin.from('crm_circuit_breaker').insert({
      organization_id: orgId,
      crm_base_url: crmBaseUrl,
      state: 'closed',
      consecutive_failures: 1,
    });
    return { opened: false };
  }

  const failures = (existing.consecutive_failures as number) + 1;

  // Check if within the failure window
  const openedAt = existing.opened_at ? new Date(existing.opened_at as string) : null;
  const withinWindow = openedAt && now.getTime() - openedAt.getTime() <= FAILURE_WINDOW_MS;

  if (failures >= FAILURE_THRESHOLD && !withinWindow) {
    // Open the circuit
    const closeAfter = new Date(now.getTime() + COOLDOWN_MS);
    await supabaseAdmin
      .from('crm_circuit_breaker')
      .update({
        state: 'open',
        consecutive_failures: failures,
        opened_at: now.toISOString(),
        close_after: closeAfter.toISOString(),
      })
      .eq('organization_id', orgId);

    return { opened: true };
  }

  await supabaseAdmin
    .from('crm_circuit_breaker')
    .update({ consecutive_failures: failures })
    .eq('organization_id', orgId);

  return { opened: false };
}
