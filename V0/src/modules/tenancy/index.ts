export { provisionOrg } from './provision';
export type { ProvisionOrgInput, ProvisionOrgResult } from './provision';

export { getTenantContext, getTenantContextOrNull, runWithTenantContext } from './context';
export type { TenantContext, BaseRole, MIHRole, Permission } from './context';

export { encryptCredential, decryptCredential } from './crypto';

export { APP_ORG_ID_SQL, tenantIsolationPolicySQL, RLS_EXEMPT_TABLES } from './rls';

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
