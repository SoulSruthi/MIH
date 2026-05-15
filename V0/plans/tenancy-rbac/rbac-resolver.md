# RBAC Resolver

---

## The 3-Layer Resolver

```ts
// modules/rbac/service.ts

export async function resolve(
  tenantCtx: TenantContext,
  action: Permission
): Promise<boolean> {

  // Layer 1: base role explicit allow?
  if (BASE_ROLE_GRANTS[tenantCtx.baseRole].has(action)) return true;

  // Layer 2: any app role grants?
  for (const role of tenantCtx.appRoles) {
    if (APP_ROLE_GRANTS[role].has(action)) return true;
  }

  // Layer 3 (V1.5+): per-user allow/deny overrides
  // const override = await getUserPermissionOverride(tenantCtx.userId, action);
  // if (override === 'allow') return true;
  // if (override === 'deny') return false;

  return false;
}
```

**Cache:** Upstash KV, key = `t:{orgId}:rbac:{userId}`, TTL = 5 min. Invalidated on any role change.

---

## Base Role Grants

```ts
const BASE_ROLE_GRANTS: Record<BaseRole, Set<Permission>> = {
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
```

---

## App Role Grants

```ts
const APP_ROLE_GRANTS: Record<MIHRole, Set<Permission>> = {
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
```

---

## Usage Pattern (Server Actions + Route Handlers)

```ts
// In any Server Action or Route Handler
export async function myAction(input: unknown) {
  const ctx = getTenantContext();  // from AsyncLocalStorage

  const allowed = await rbac.resolve(ctx, 'source:configure:org');
  if (!allowed) throw new ForbiddenError('source:configure:org');

  // ... proceed with action
}
```

---

## Defense in Depth

RBAC check happens at **two layers**:

1. **Server Action / Route Handler entry** — throws `ForbiddenError` (→ 403)
2. **Service layer** — re-checks before any state-changing operation

Never trust the UI to gate. Never skip the service-layer check because "the route already checked."

---

## Token-Based Access (API Tokens, V1+)

API tokens issued to sister products or external builders carry a **subset** of the issuing user's permissions, scoped to specific resources. Token permissions are resolved the same way but with an additional scope ceiling.

```ts
type APIToken = {
  token_hash: string;
  organization_id: string;
  issued_by_user_id: string;
  permissions: Permission[];  // explicit subset
  expires_at: Date;
};
```
