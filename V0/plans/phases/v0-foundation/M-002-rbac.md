# M-002 · RBAC Engine

**Depends on:** M-001  
**Effort:** 2 days  
**V5 build prompt:**
```
Build feature: RBAC engine — 6 roles (super_admin, mih_org_admin, marketing_manager,
marketing_analyst, marketing_ops, org_viewer), permission map, 3-layer resolver,
Upstash KV cache with 5-min TTL, JWT claim extraction
```

---

## Purpose

Six roles with defined permissions. Same 3-layer resolver pattern as the AI CRM.

---

## In Scope

- Role definitions: see `plans/tenancy-rbac/roles.md`
- Permission map: all `resource:action:scope` tuples per role
- 3-layer resolver: base role → app roles → (Layer 3 stubbed for V1.5)
- Upstash KV caching: `t:{orgId}:rbac:{userId}`, TTL = 5 min
- Cache invalidation on any role change
- JWT claim extraction: `base_role` and `app_roles` from JWT
- `requirePermission(action)` middleware for Server Actions + Route Handlers

---

## Acceptance Criteria

```
[ ] super_admin can: view all orgs, suspend any org, invite to any org
[ ] super_admin CANNOT: view raw_leads of any specific org without impersonation
[ ] mih_org_admin can: configure sources, manage users, configure CRM connection
[ ] mih_org_admin CANNOT: view another org's data
[ ] marketing_manager can: view + customize dashboards, view campaigns
[ ] marketing_manager CANNOT: configure sources or manage users
[ ] marketing_analyst can: view raw_leads, create reports
[ ] marketing_ops can: configure sources, replay DLQ
[ ] org_viewer can: view dashboard only
[ ] org_viewer CANNOT: customize dashboard, view raw_leads, configure anything
[ ] Role change → Upstash cache invalidated within 5 min
[ ] Missing permission → 403 ForbiddenError (not 500)
```

---

## Module Location

```
modules/rbac/
  index.ts              exports: resolve, requirePermission, getRoleGrants
  service.ts            resolve() — 3-layer resolver
  grants.ts             BASE_ROLE_GRANTS + APP_ROLE_GRANTS constants
  cache.ts              Upstash KV cache operations
  middleware.ts         requirePermission() for Server Actions
  impersonate.ts        super admin impersonation flow (scaffolded; implemented in M-011)
```

---

## Migration File

`supabase/migrations/002_rbac_memberships_index.sql` (indexes on memberships for role lookups)
