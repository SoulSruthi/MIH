# Multi-Tenancy Architecture

---

## Tenancy Hierarchy (V0–V1)

```
Builtrix Platform
└── Organization        ← billing entity; one real estate builder
    └── Membership      ← user × org × role
        └── User
```

Deliberately flat. No business units, no teams at V0–V1.  
**When to add BU/Team (V1.5–V2 trigger):** First builder with ≥3 independent marketing teams running separate budgets.

---

## Isolation Model: Pool with RLS

Single Supabase Postgres. Every business table has `organization_id`. RLS enforces isolation.

| Tier | Isolation | Implementation | Target |
|---|---|---|---|
| Standard | Pool (logical) | Shared Supabase, RLS, KV prefix `t:{orgId}:` | All V0 customers |
| Enterprise | Silo (DB) | Dedicated Supabase project, same Mumbai region | First enterprise request in V2+ |
| Sovereign | Silo (regional) | Dedicated stack in customer region | EU/GCC future |

**Why pool at V0:**
- 1–20 customers: silo = 20× infra cost, zero margin
- RLS + tested isolation is sufficient defense
- Migration to silo per-tenant via logical replication when needed

---

## Tenant Context Object

```ts
// Created at request edge; propagated via AsyncLocalStorage
type TenantContext = {
  orgId: string;
  userId: string;
  baseRole: BaseRole;          // 'super_admin' | 'org_user'
  appRoles: MIHRole[];         // 'mih_org_admin' | 'marketing_manager' | ...
  permissions: Permission[];   // resolved by RBAC service
  isolation: 'pool' | 'silo';
  tier: 'standard' | 'enterprise';
  requestId: string;           // trace correlation; in every log line
};
```

**Propagation rules — no exceptions:**

| Where | Rule |
|---|---|
| Every Postgres query | Use Supabase client constructed with user's JWT (RLS active) |
| Every Inngest event payload | Carry `{ org_id, request_id, causation_id }` |
| Every Upstash KV key | Prefix `t:{orgId}:...` |
| Every log line | Include `org_id` and `request_id` |
| Every external HTTP call | Tag with `X-Builtrix-Org-Id` header |

---

## Org-to-CRM Mapping

Decision H.1 (locked): **1:1**. One MIH org maps to exactly one CRM org.

```
organizations.crm_organization_id   uuid, nullable until connected
organizations.crm_api_token_id      FK → credentials(id)
organizations.crm_hmac_secret_id    FK → credentials(id)
organizations.crm_base_url          text, default 'https://crm.builtrix.io'
```

Provisioning RPC `provision_mih_org()` accepts `crm_organization_id` and verifies via a health ping to the CRM before creating the org row.

---

## Shared Auth Project (H.2 locked)

Shared Supabase Auth project across MIH + CRM + Voice IQ. Separate Supabase databases per product.

One user, one credential, three apps. JWT custom claims:

```json
{
  "sub": "<supabase-auth-user-id>",
  "organization_id": "<mih-org-uuid>",
  "base_role": "org_user",
  "app_roles": ["mih_org_admin"],
  "iss": "supabase",
  "exp": 1234567890
}
```

---

## Nightly Tenant-Leak Audit

Mandatory from M-001. Runs nightly via pg_cron or Inngest cron.

- Detects: NULL `organization_id` in any tenant-scoped table
- Detects: `organization_id` referencing a deleted org
- Detects: cross-tenant FK violations (e.g., `raw_leads.organization_id` ≠ `unique_leads.organization_id`)

**On failure:** Pages oncall. Until V2 oncall rotation exists, emails founder. Non-negotiable.

---

## Org Provisioning Flow

```
Super admin: POST /api/platform/orgs/provision
  → validate CRM org_id via GET <crm_base_url>/api/sister/v1/health
  → insert organizations row
  → insert memberships row (owner_email, base_role='org_user', app_roles=['mih_org_admin'])
  → insert dedup_rules row (defaults: phone_window=24h, email_dedup=false)
  → fire audit_log: action='org.provisioned'
  → invite owner_email via Supabase Auth invite
  → return { org_id, invite_url }
```
