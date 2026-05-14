export { provisionOrg } from './provision.js';
export type { ProvisionOrgInput, ProvisionOrgResult } from './provision.js';

export { getTenantContext, getTenantContextOrNull, runWithTenantContext } from './context.js';
export type { TenantContext, BaseRole, MIHRole, Permission } from './context.js';

export { encryptCredential, decryptCredential } from './crypto.js';

export { APP_ORG_ID_SQL, tenantIsolationPolicySQL, RLS_EXEMPT_TABLES } from './rls.js';

/** Fetch a single org by id using the service-role client. */
export async function getOrgById(
  supabaseAdmin: import('@supabase/supabase-js').SupabaseClient,
  orgId: string,
) {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single();
  if (error) throw new Error(`getOrgById failed: ${error.message}`);
  return data;
}
