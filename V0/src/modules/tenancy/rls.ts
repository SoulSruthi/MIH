/**
 * SQL fragment for app_org_id() — source of truth is the migration file.
 * Exported here so migration helpers can verify or re-apply in test fixtures.
 */
export const APP_ORG_ID_SQL = `
CREATE OR REPLACE FUNCTION public.app_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json->>'organization_id',
    ''
  )::uuid
$$;
`.trim();

/**
 * Standard RLS policy SQL for a tenant-scoped table.
 * Used by migration helpers and test fixture generators.
 */
export function tenantIsolationPolicySQL(tableName: string): string {
  return [
    `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`,
    `CREATE POLICY ${tableName}_tenant_isolation ON ${tableName}`,
    `  USING (organization_id = public.app_org_id())`,
    `  WITH CHECK (organization_id = public.app_org_id());`,
  ].join('\n');
}

/** Tables that intentionally have NO RLS (platform-layer access only). */
export const RLS_EXEMPT_TABLES = ['organizations', 'audit_log'] as const;
