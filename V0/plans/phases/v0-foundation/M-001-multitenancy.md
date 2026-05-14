# M-001 · Multi-Tenancy Foundation

**Depends on:** nothing (this is the foundation)  
**Blocks:** M-002, M-003, and everything downstream  
**Effort:** 3 days  
**V5 build prompt:**
```
Build feature: multi-tenancy foundation — organizations table, memberships table,
RLS on both, app_org_id() SECURITY DEFINER function, provision_mih_org() RPC,
nightly tenant_leak_check() audit function, cross-tenant test suite
```

---

## Purpose

Establish org isolation as the foundational guarantee. Every row in every table is scoped to an `organization_id`; every query enforces this at the RLS layer.

---

## User Story

As a Builtrix super admin, when I provision a new builder's MIH org, all their data must be invisible to every other builder, enforced at the database level — not just at the app layer.

---

## In Scope

### Tables
- `organizations` (see schema-v0.sql)
- `memberships` (see schema-v0.sql)
- `credentials` table (scaffolded; used from M-002 onwards)

### Functions
- `public.app_org_id()` — SECURITY DEFINER, reads `organization_id` from JWT custom claim
- `provision_mih_org(org_name, slug, owner_email, crm_organization_id, crm_base_url)` RPC

### Provisioning flow
1. Validate CRM org_id via `GET <crm_base_url>/api/sister/v1/health` (or skip if crm_organization_id=null)
2. Insert `organizations` row
3. Insert `memberships` row (owner as `mih_org_admin`)
4. Insert `dedup_rules` row (defaults)
5. Fire `audit_log` row: `action='org.provisioned'`
6. Return `{ org_id, invite_url }`

### Nightly audit
- `audit.tenant_leak_check()` function (see schema-v0.sql)
- Inngest cron: `audit.tenant_leak` daily at 03:00 IST
- On failure: email founder (until V2 oncall)

---

## Acceptance Criteria

```
[ ] Cross-tenant isolation: org A CANNOT SELECT any row scoped to org B
[ ] Cross-tenant isolation: org A CANNOT INSERT rows with org B's organization_id
[ ] Cross-tenant isolation: org A CANNOT UPDATE or DELETE org B's rows
[ ] Super admin service role query → returns all orgs (RLS bypass by design)
[ ] JWT with no organization_id claim → all tenant-scoped tables return zero rows
[ ] provision_mih_org() creates org + membership + dedup_rules + audit_log in one transaction
[ ] tenant_leak_check() returns empty result set on clean data
[ ] tenant_leak_check() returns at least one row when a leak is manually injected
```

---

## Test Coverage Required

- `tests/rbac/cross-tenant-isolation.test.ts` — full CRUD isolation for all tables added in M-001
- `tests/tenancy/provision.test.ts` — provisioning RPC happy path + failure cases
- `tests/tenancy/tenant-leak-check.test.ts` — audit function accuracy

---

## Module Location

```
modules/tenancy/
  index.ts            exports: provisionOrg, getTenantContext, getOrgById
  provision.ts        provision_mih_org logic
  rls.ts              app_org_id() SQL + migration helpers
  context.ts          AsyncLocalStorage TenantContext setup
  crypto.ts           AES-256-GCM credential encrypt/decrypt (used in M-002+)
```

---

## Migration File

`supabase/migrations/001_multitenancy_foundation.sql`
