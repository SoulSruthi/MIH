import type { BaseRole, MIHRole } from '../tenancy/context.js';

export type Permission = string;

export const BASE_ROLE_GRANTS: Record<BaseRole, Set<Permission>> = {
  super_admin: new Set([
    'organization:view:platform',
    'organization:update:platform',
    'organization:suspend:platform',
    'source:view:platform',
    'billing:view:platform',
    'audit_log:view:platform',
    'user:invite:any_org',
  ]),
  org_user: new Set([
    'organization:view:org',
  ]),
};

export const APP_ROLE_GRANTS: Record<MIHRole, Set<Permission>> = {
  mih_org_admin: new Set([
    'source:configure:org', 'source:disconnect:org', 'source:test:org',
    'dedup_rule:configure:org',
    'unique_lead:view:org', 'unique_lead:force_unmerge:org',
    'crm_connection:configure:org', 'crm_connection:rotate_token:org', 'crm_connection:view:org',
    'spend:view:org', 'spend:edit_manual:org',
    'attribution_rollup:view:org', 'attribution_rollup:recompute:org',
    'dashboard:view:org', 'dashboard:customize:org',
    'report:view:org', 'report:create:org', 'report:export:org',
    'user:invite:org', 'user:change_role:org', 'user:remove:org',
    'billing:view:org', 'billing:manage:org',
    'audit_log:view:org', 'audit_log:export:org',
  ]),
  marketing_manager: new Set([
    'source:view:org',
    'dedup_rule:view:org',
    'unique_lead:view:org',
    'crm_connection:view:org',
    'spend:view:org',
    'attribution_rollup:view:org',
    'dashboard:view:org', 'dashboard:customize:org',
    'report:view:org', 'report:create:org',
    'billing:view:org',
  ]),
  marketing_analyst: new Set([
    'source:view:org',
    'dedup_rule:view:org',
    'raw_lead:view:org',
    'unique_lead:view:org',
    'crm_connection:view:org',
    'spend:view:org',
    'attribution_rollup:view:org',
    'dashboard:view:org',
    'report:view:org', 'report:create:org', 'report:export:org',
    'audit_log:view:org',
  ]),
  marketing_ops: new Set([
    'source:configure:org', 'source:test:org',
    'dedup_rule:view:org',
    'raw_lead:view:org', 'raw_lead:replay:org',
    'unique_lead:view:org',
    'crm_connection:view:org',
    'spend:view:org', 'spend:edit_manual:org',
    'attribution_rollup:view:org',
    'dashboard:view:org',
    'report:view:org',
    'audit_log:view:org',
  ]),
  org_viewer: new Set([
    'attribution_rollup:view:org',
    'dashboard:view:org',
  ]),
};

export function getRoleGrants(role: BaseRole | MIHRole): Set<Permission> {
  if (role in BASE_ROLE_GRANTS) return BASE_ROLE_GRANTS[role as BaseRole];
  return APP_ROLE_GRANTS[role as MIHRole] ?? new Set();
}
