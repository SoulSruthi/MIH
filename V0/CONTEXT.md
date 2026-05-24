# MIH V2.4 — Claude Context Document

> Last updated: 2026-05-24  
> Working branch: `claude/eager-wozniak-4668k`  
> Base app: Next.js 16 App Router at `/home/user/MIH/V0`  
> Supabase project: `poooyfyonogxupnmxdcp` (`https://poooyfyonogxupnmxdcp.supabase.co`)

---

## Architecture Overview

| Layer | Detail |
|-------|--------|
| Framework | Next.js 16 (App Router, `src/app/`) |
| Database | Supabase, all MIH tables under `mih.*` schema — always use `.schema('mih')` |
| Auth | Supabase Auth, org UUID from `useOrgId()` hook (`src/lib/use-org-id.ts`) |
| Background jobs | Inngest, served at `/api/inngest` (`src/app/api/inngest/route.ts`) |
| Tests | Vitest, in-memory Supabase stub pattern (see `tests/` directory) |
| TypeScript | `ignoreBuildErrors: true` in `next.config.ts` — Supabase `.schema('mih')` calls produce type errors codebase-wide, all pre-existing |

---

## Database

**Schema**: All production tables live in the `mih` schema. Always call `.schema('mih').from('table_name')` — never `.from('table_name')` directly.

**Demo org**: `00000000-0000-0000-0000-000000000001` (Prestige Realty) — used in demo-mode components via `const ORG_ID = '00000000-0000-0000-0000-000000000001'`.

**Supabase Admin access**: `getSupabaseAdmin()` from `@/lib/supabase-admin` — uses service role key, bypasses RLS.

**Key tables (mih schema)**:

| Table | Purpose |
|-------|---------|
| `raw_leads` | All inbound leads from all sources |
| `raw_inbox` | Deduplicated lead messages |
| `identity_nodes` / `identity_edges` / `identity_clusters` | Identity graph |
| `golden_records` | Canonical lead profiles |
| `site_visit_events` | CRM site visit records |
| `conversion_events` | All conversion milestones (site visit, booking, deal) |
| `attribution_results` | First/last/time-decay attribution outputs |
| `attribution_models` | Model registry (`first_touch_v1` = operational, `is_operational: true`) |
| `sources` | Marketing channels/sources |
| `spend_entries` | Canonical spend table (NOT `spend_daily`) — upsert with `onConflict: 'org_id,ingestion_source,external_ref'` |
| `spend_contracts` | Recurring vendor contracts |
| `reconciliation_items` | 10 item types, state machine workflow |
| `reconciliation_audit` | Audit trail for reconciliation state changes |
| `budget_plans` / `budget_allocations` / `budget_actuals` | Budget tracking |
| `sf_import_jobs` / `sf_import_row_errors` | Salesforce import jobs |
| `cp_commission_accruals` | Channel partner commission accruals |

**Migrations** (in `supabase/migrations/`):
- 001–013: V1 foundation (multitenancy, RBAC, connectors, raw leads, identity, spend, billing)
- 014–020: V2 MIH core (mih schema, taxonomy, ingestion, identity, attribution, site visits, projects)
- 021–025: V2.4 Phase 3+4 (budget, channel partners, referrals, ROI reporting, reconciliation queue)

---

## Feature Map (Phase 4 — complete as of v2.4)

### Spend Sync (`src/inngest/functions/spend-sync.ts`)
- Cron: `0 2 * * *` (2am UTC daily)
- Reads Meta Ads + Google Ads connector configs
- Writes to `mih.spend_entries` (NOT legacy `spend_daily`)
- `external_ref` format: `meta_act_{adAccountId}_{YYYY-MM-DD}` / `google_{customerId}_{YYYY-MM-DD}`
- `ingestion_source`: `'meta_ads'` / `'google_ads'`

### Attribution Runner (`src/modules/mih-attribution/runner.ts`)
- `runAttributionForConversionEvent(args, supabase)` — main entry point
- Runs first-touch + comparison models (last_touch, time_decay)
- When CP-block rule fires: writes to `mih.disputed_attributions` AND auto-creates `disputed_cp_credit` reconciliation item
- Import: `import { createItem } from '@/modules/reconciliation/queue'`

### Site Visit Consumer (`src/modules/site-visits/consumer.ts`)
- `consumeSiteVisitEvent(payload, deps)` — dependency-injected
- Unmatched walk-ins (`walk_in_unscheduled` + no `cluster_id`): auto-creates `unmatched_walk_in` reconciliation item
- Import: `import { createItem } from '@/modules/reconciliation/queue'`

### Reconciliation Module (`src/modules/reconciliation/`)

| File | Purpose |
|------|---------|
| `queue.ts` | `createItem`, `getItem`, `listItems`, `updateState`, `deduplicateItem` |
| `resolver.ts` | `resolveItem` — orchestrates state change + downstream actions + audit |
| `actions.ts` | `executeResolutionActions` — dispatcher for downstream effects by item_type |
| `sla.ts` | `assignSLADeadline` — severity → SLA deadline mapping |
| `types.ts` | `ReconciliationItem`, `CreateReconciliationItemInput`, `ReconciliationAuditEntry` |

**10 item types**: `disputed_cp_credit`, `unmatched_walk_in`, `manual_call_no_tracking`, `low_conf_identity_merge`, `duplicate_lead_cluster`, `spend_overrun`, `booking_shortfall`, `orphan_spend_investigation`, `data_gap_alert`, `sla_breach_escalation`

**State machine**: `open → in_review → escalated → resolved → closed` / `expired`

### Reconciliation API Routes (`src/app/api/reconciliation/`)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/reconciliation` | GET | List items (filterable by state/severity/type) |
| `/api/reconciliation/[id]` | GET/PATCH | Item detail + resolve |
| `/api/reconciliation/[id]/audit` | GET | Audit trail for item |
| `/api/reconciliation/[id]/geo-suggestions` | GET | Active nearby sources for unmatched walk-in |
| `/api/reconciliation/bulk-resolve` | POST | Bulk resolve with two-step confirm |
| `/api/reconciliation/audit` | GET | Queue-level stats (ageing, SLA %, by-type) |
| `/api/reconciliation/sf-import` | GET/POST | List/create SF import jobs |
| `/api/reconciliation/sf-import/[id]` | GET/POST | Job detail + process rows |

All routes require `x-org-id` header.

**SF Import supports**: `leads`, `opportunities`, `contacts`, `calls`, `comments`

### ROI Reporting (`src/modules/roi-reporting/`)

| File | Purpose |
|------|---------|
| `contract-amortizer.ts` | `amortizeContract(contract, supabase)` — creates monthly/weekly `spend_entries` |
| `cpb-calculator.ts` | Cost-per-booking metric calculations |
| `funnel-aggregator.ts` | Funnel conversion rates |
| `snapshot-refresher.ts` | Snapshot refresh jobs |
| `variance-detector.ts` | Plan vs actual variance alerts |
| `types.ts` | Shared types |

### Inngest Functions (`src/inngest/functions/`)

| Function | Cron | Purpose |
|----------|------|---------|
| `spend-sync` | `0 2 * * *` | Meta + Google Ads spend pull |
| `attribution-rollup` | varies | Attribution aggregation |
| `anomaly-digest` | varies | Spend anomaly detection |
| `attribution-recompute` | varies | Recompute stale attribution |
| `project-source-autodisable` | varies | Auto-disable inactive sources |
| `plan-variance-check` | `30 18 * * *` (midnight IST) | Budget variance alerts |
| `orphan-spend-detection` | `0 19 * * 0` (Mon 1am IST) | Orphan spend > ₹50K |
| `sla-expiry` | `0 1 * * *` | SLA escalation + auto-expire |

### UI Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/roi` | `RoiDashboard` | CPB overview, variance alerts, navigation |
| `/roi/alerts` | `VarianceAlerts` | Budget variance alert list |
| `/roi/comparison` | `ComparisonModelView` | First/last/time-decay model comparison |
| `/roi/spend` | `SpendManagement` | Contract management |
| `/reconciliation` | `ReconciliationQueue` | Open item queue |
| `/reconciliation/[id]` | `ReconciliationItemDetail` | Item detail + resolution + geo-suggestions |
| `/reconciliation/sf-import` | `SalesforceImport` | CSV upload for 5 SF object types |
| `/reconciliation/audit` | `AuditDashboard` | Queue stats, ageing histogram, SLA % |

---

## Testing

**Test runner**: Vitest (`npx vitest run`)

**Pattern**: In-memory Supabase stub using `Map<string, MockRow[]>`. Each `buildChain(table)` call creates a fresh chain. Use `vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => stubHolder.instance }))`.

**Key gotcha**: The stub must return COPIES of rows on SELECT (use `{ ...row }`) so that `updateState`'s `existing` reference isn't mutated by subsequent updates.

**Test files**:
```
tests/reconciliation/
  contract-amortizer.test.ts   — 7 tests
  actions.test.ts               — 8 tests  
  orphan-spend.test.ts          — 6 tests
  sla-expiry.test.ts            — 7 tests
  resolver.test.ts              — 7 tests
```

Run: `npx vitest run tests/reconciliation/` — all 36 tests pass.

---

## Important Decisions / Non-obvious Behaviours

1. **Spend table**: `mih.spend_entries` is canonical. `spend_daily` is legacy — do not write to it.
2. **Attribution model**: `first_touch_v1` with `is_operational: true` is the operational model. `last_touch_v1` and `time_decay_v1` are comparison-only.
3. **Reconciliation items are non-fatal**: `createItem()` calls in runner.ts and consumer.ts are wrapped in try/catch — a queue failure must never block attribution or site visit recording.
4. **Bulk resolve requires confirmation**: POST to `/api/reconciliation/bulk-resolve` without `confirm: true` returns a preview. Re-submit with `confirm: true` to execute.
5. **SF import state machine**: Create job (`POST /sf-import`) → process rows (`POST /sf-import/[id]`) → check status (`GET /sf-import/[id]`).
6. **Contract amortizer**: Runs automatically after contract creation (`POST /api/spend/contracts`). PATCH to terminate deletes future `recurring_amortized` entries.
7. **CP commission accrual rate**: Default 2.5% (`commission_pct: 0.025`).
8. **Indian FY**: April–March. Fiscal year calculation: month < 3 (Jan–Mar) belongs to the previous FY year.
9. **`.schema('mih')` TS errors**: Pre-existing across the codebase, ignored via `ignoreBuildErrors: true`. Not new errors.

---

## Git / Deployment

- **Development branch**: `claude/eager-wozniak-4668k`
- **Stable branch**: `v2.4` (do NOT push to this without explicit approval)
- **Never push to `main`**
- Supabase project ref: `poooyfyonogxupnmxdcp`
- Access token: stored in session, not in code — use `SUPABASE_ACCESS_TOKEN=sbp_...` env var with `supabase` CLI
- Push migrations: `SUPABASE_ACCESS_TOKEN=sbp_... supabase link --project-ref poooyfyonogxupnmxdcp && supabase db push --linked`

---

## File Reference

```
src/
  app/
    api/
      inngest/route.ts           — Inngest serve handler (all functions registered here)
      reconciliation/            — Reconciliation API routes
      spend/                     — Spend management API
      variance/alerts/           — Variance alert API
    reconciliation/              — Reconciliation UI pages
    roi/                         — ROI dashboard pages
  components/
    layout/
      AppShell.tsx               — App shell with sidebar
      Sidebar.tsx                — Navigation sidebar (all routes)
    reconciliation/              — Reconciliation UI components
    roi/                         — ROI UI components
  inngest/
    client.ts                    — Inngest client
    functions/                   — All background job functions
  lib/
    supabase-admin.ts            — getSupabaseAdmin() — service role client
    use-org-id.ts                — useOrgId() hook — reads org UUID from auth session
  modules/
    mih-attribution/             — Attribution engine (runner, engine, comparison models)
    reconciliation/              — Reconciliation workflow (queue, resolver, actions, sla)
    roi-reporting/               — ROI calculations and contract amortizer
    site-visits/                 — Site visit consumer
    spend/                       — Legacy spend module (writes to spend_daily — do not use)
supabase/
  migrations/                    — All 025 SQL migrations
tests/
  reconciliation/                — Phase 4 test suites
  attribution/                   — Attribution engine tests
  site-visits/                   — Site visit consumer tests
```
