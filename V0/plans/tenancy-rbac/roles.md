# Roles and Permission Matrix

---

## The Six Roles

| Role | Landing Page | Purpose |
|---|---|---|
| `super_admin` | `/platform` | Builtrix internal — full org management, platform health, audited impersonation |
| `mih_org_admin` | `/admin` | Builder's marketing org admin — sources, CRM connection, users, billing |
| `marketing_manager` | `/dashboard` | Daily campaign performance — view + customize dashboards, view campaigns |
| `marketing_analyst` | `/reports` | Build reports, saved views, AI diagnostics (V2+) |
| `marketing_ops` | `/sources` | Configure connectors, view raw leads, manage DLQ, replay failed leads |
| `org_viewer` | `/dashboard` (read-only) | Founders, CMOs, board — dashboard view only |

---

## Permission Matrix

| Resource | super_admin | mih_org_admin | marketing_manager | marketing_analyst | marketing_ops | org_viewer |
|---|---|---|---|---|---|---|
| organization | view, update, suspend | view, update | view | view | view | view |
| source | view(aggregate) | configure, disconnect, test | view | view | configure, test | — |
| dedup_rule | view | configure | view | view | view | — |
| raw_lead | — | view | — | view | view, replay | — |
| unique_lead | — | view, force_unmerge | view(aggregate) | view | view | — |
| crm_connection | — | configure, rotate_token | view | view | view | — |
| spend | — | view, edit_manual | view | view | view, edit_manual | — |
| attribution_rollup | — | view, recompute | view | view | view | view |
| dashboard | — | view, customize | view, customize | view | view | view |
| report | — | view, create, export | view, create | view, create, export | view | view |
| user | invite(any org) | invite, change_role, remove | — | — | — | — |
| billing | view(all) | view, manage | view | — | — | — |
| audit_log | view(platform) | view(own org), export | — | view | view | — |
| ai (V2+) | — | configure_policy | query | query | — | — |

---

## Permission Format

```
Permission = <resource> : <action> : <scope>

Examples:
  source:configure:org           configure any source in the org
  raw_lead:view:org              view raw leads across the org
  dashboard:customize:own        customize own dashboards
  attribution_rollup:view:org    view org-wide attribution
  audit_log:export:org           export audit log
```

---

## Role Architecture Rules

1. **`base_role`** (`super_admin` | `org_user`) — stored on `memberships.base_role`. Platform-level, set at provisioning.
2. **`app_roles`** (`mih_org_admin` | `marketing_manager` | ...) — stored as `text[]` on `memberships.app_roles`. App-specific, assignable by org admin.
3. **One user can hold multiple app_roles.** A marketing analyst who also manages sources would have `['marketing_analyst', 'marketing_ops']`.
4. **Permission is evaluated at request time** — not cached in the JWT. JWT carries roles; resolver derives permissions.

---

## Conscious Omissions at V0

| Missing | Why deferred | Trigger |
|---|---|---|
| Per-source role (e.g., "only sees 99acres leads") | Role explosion; complex to test | First enterprise request |
| Custom roles (org-defined) | Needs DB-backed permission storage | V1.5+ |
| Team/BU scoping | Over-engineering for ICP at V0 | First builder with ≥3 independent teams |
| Per-user permission overrides | Layer 3 of resolver is stubbed out | V1.5 |
