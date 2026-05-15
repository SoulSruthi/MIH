import type { SupabaseClient } from '@supabase/supabase-js';

export type ProvisionOrgInput = {
  orgName: string;
  slug: string;
  ownerUserId: string;
  crmOrganizationId?: string;
  crmBaseUrl?: string;
};

export type ProvisionOrgResult = {
  orgId: string;
};

/**
 * Provisions a new MIH org via the provision_mih_org() Supabase RPC.
 * Validates CRM connectivity before calling if crmOrganizationId is provided.
 * Must be called with the service-role client (bypasses RLS by design).
 */
export async function provisionOrg(
  supabaseAdmin: SupabaseClient,
  input: ProvisionOrgInput,
): Promise<ProvisionOrgResult> {
  const { orgName, slug, ownerUserId, crmOrganizationId, crmBaseUrl } = input;

  if (crmOrganizationId && crmBaseUrl) {
    await verifyCrmHealth(crmBaseUrl);
  }

  const { data, error } = await supabaseAdmin.rpc('provision_mih_org', {
    p_org_name: orgName,
    p_slug: slug,
    p_owner_user_id: ownerUserId,
    p_crm_organization_id: crmOrganizationId ?? null,
    p_crm_base_url: crmBaseUrl ?? 'https://crm.builtrix.io',
  });

  if (error) throw new Error(`provision_mih_org failed: ${error.message}`);
  if (!data?.org_id) throw new Error('provision_mih_org returned no org_id');

  return { orgId: data.org_id as string };
}

async function verifyCrmHealth(crmBaseUrl: string): Promise<void> {
  const url = `${crmBaseUrl.replace(/\/$/, '')}/api/sister/v1/health`;
  let res: Response;
  try {
    res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
  } catch (err) {
    throw new Error(`CRM health check failed (${url}): ${(err as Error).message}`);
  }
  if (!res.ok) {
    throw new Error(`CRM health check returned HTTP ${res.status} for ${url}`);
  }
}
