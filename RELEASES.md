# MIH Release Notes

---

## v2.4 — Phase 3 + Phase 4: Budget, Channel Partners, Referrals, ROI, Reconciliation
**Released:** 2026-05-22
**Branch:** `v2.4`
**DB migrations:** 021–025 applied

### What's in v2.4

#### Spec 07 — Budget Planning Engine (Phase 3)
- **Migration 021** — Alters `mih.budgets` with state machine (`draft|in_review|approved|active|superseded|archived`), plan metadata (`plan_code`, `total_booking_target_value`, `default_spend_pct`), approval fields; adds `mih.budget_allocations` (per-project × medium × source breakdown), `mih.budget_actuals` (running pacing for variance)
- **Module** — `src/modules/budget/service.ts` — createBudget, activateBudget, getVariance, updateActuals
- **APIs**
  - `GET/POST /api/budget`
  - `GET/PATCH /api/budget/[id]`
  - `POST /api/budget/[id]/activate`
  - `GET /api/budget/[id]/periods`
  - `GET /api/budget/[id]/variance`
- **UI pages** — `/budget`, `/budget/[id]`

#### Spec 08 — Channel Partner Management (Phase 3)
- **Migration 022** — Alters `mih.channel_partners` with `cp_type`, `parent_cp_id`, `default_commission_pct`, `rera_number`, encrypted PAN/bank; adds `mih.cp_api_keys`, `mih.cp_commission_overrides`, `mih.cp_lead_pushes`, `mih.cp_commission_accruals` (state machine: `earned→accrued→approved→paid→reversed→disputed`, `commission_value` generated column), `mih.cp_fy_targets`
- **Module** — `src/modules/channel-partners/service.ts` — createCP, generateApiKey, createAccrual, approveAccrual, calculateCommission
- **APIs**
  - `GET/POST /api/channel-partners`
  - `GET/PATCH /api/channel-partners/[id]`
  - `GET /api/channel-partners/[id]/commissions`
  - `PATCH /api/channel-partners/[id]/commissions/[cid]`
  - `GET/POST /api/channel-partners/[id]/api-keys`
- **UI pages** — `/channel-partners`, `/channel-partners/[id]`

#### Spec 09 — Referral Program (Phase 3)
- **Migration 023** — Alters `mih.referrers` with `referrer_code`, `crm_customer_id`, `bookings_count`, `consent_state` (`pending|opted_in|opted_out|revoked`), `consent_channels[]`, `default_commission_pct=0.015`, `reward_preference`; adds `mih.referral_submissions`, `mih.referral_commission_accruals` (same state machine as CP, plus `reward_kind`)
- **Module** — `src/modules/referrals/service.ts` — createReferrer, submitReferral, updateConsent, createAccrual
- **APIs**
  - `GET/POST /api/referrals`
  - `GET/PATCH /api/referrals/[id]`
  - `GET /api/referrals/[id]/commissions`
- **UI pages** — `/referrals`, `/referrals/[id]`

#### Spec 10 — ROI Reporting (Phase 4)
- **Migration 024** — `mih.spend_entries` (idempotent via `UNIQUE(org_id, ingestion_source, external_ref)`), `mih.spend_contracts` (amortization types: monthly/weekly/one_time/custom), `mih.metric_snapshots` (pre-aggregated JSONB, `dimension_key` + `metric_set`), `mih.variance_alerts` (alert types + severity), `mih.saved_reports`
- **Modules** — `src/modules/roi-reporting/`
  - `cpb-calculator.ts` — CPB/CPQL/CPL; zero-bookings → 0 (render as "—"), never NaN or /0
  - `funnel-aggregator.ts` — Lead→Qual→SV Sched→SV Done→Booked per source/project
  - `snapshot-refresher.ts` — event-driven metric snapshot refresh
  - `variance-detector.ts` — thresholds: spend >115% → warning, >125% → critical; bookings <70% paced → shortfall
- **APIs**
  - `GET/POST /api/spend/entries`
  - `GET/PATCH/DELETE /api/spend/entries/[id]`
  - `GET/POST /api/spend/contracts`
  - `GET /api/spend/unallocated`
  - `GET /api/metrics/snapshots`
  - `GET /api/metrics/funnel`
  - `GET /api/variance/alerts`
  - `POST /api/variance/alerts/[id]/resolve`
- **UI pages** — `/roi` (CPB dashboard + funnel), `/roi/spend` (spend management), `/roi/alerts` (variance alerts)

#### Spec 11 — Manual Reconciliation (Phase 4)
- **Migration 025** — `mih.reconciliation_items` (10 item types, state machine: `open→in_review→resolved→escalated→closed→expired`, SLA deadlines, `context JSONB`, `resolution_actions JSONB`, dedup unique on `(org_id, item_type, cluster_id, origin_event_id)`), `mih.reconciliation_audit` (append-only, immutable), `mih.sf_import_jobs`, `mih.sf_import_row_errors`
- **Modules** — `src/modules/reconciliation/`
  - `queue.ts` — createItem, updateState, deduplicateItem
  - `resolver.ts` — resolveItem, buildResolutionContext
  - `sla.ts` — assignSLADeadline, checkBreached
- **APIs**
  - `GET/POST /api/reconciliation`
  - `GET/PATCH /api/reconciliation/[id]`
  - `GET /api/reconciliation/[id]/audit`
  - `POST /api/reconciliation/bulk-resolve`
- **UI pages** — `/reconciliation` (queue with filters), `/reconciliation/[id]` (detail + resolution)

#### Navigation
- Sidebar updated: Budget, Partners (CP + Referrals), ROI, Reconciliation sections added

---

## v2.3 — Gap Fix
**Released:** 2026-05-22
**Branch:** `v2.3`

### Fixes
- Added `GET /api/attribution/conversion-events/[id]` — individual conversion event lookup (gap from v2.2)
- DB: all Phase 1 + Phase 2 migrations (001–020) confirmed applied and healthy

---

## v2.2 — Phase 2: Attribution Engine, Site Visits, Projects
**Released:** 2026-05-21  
**Merged PR:** #9  
**Tests:** 444 passing / 40 files  
**Vercel:** Green

### What's in v2.2

#### Spec 04 — First-Touch Attribution Engine
- **Attribution models** — `mih.attribution_models`, `mih.attribution_config`, `mih.conversion_events`, `mih.attribution_results`, `mih.disputed_attributions` (migration 018)
- **Pure attribution engine** — `src/modules/mih-attribution/engine.ts`  
  - First-touch model with configurable conversion window  
  - CP-claim block rule: blocks CP if non-CP arrived within grace period  
  - Household first-member rule: credits the first touch across household cluster IDs  
- **Comparison models** — `src/modules/mih-attribution/comparison-models.ts`  
  - `last_touch_v1`: credits most recent touchpoint  
  - `time_decay_v1`: exponential decay (lambda=0.1, ~7-day half-life)  
- **Runner** — `src/modules/mih-attribution/runner.ts`  
  - DB-aware layer: fetches touchpoints via identity_edges→nodes→raw_inbox  
  - Runs all three models per conversion event  
  - Supersedes prior results via `superseded_by_id` chain  
  - Writes disputes for flagged attributions  
  - Updates `project_source_history` on winning attribution  
- **APIs**
  - `GET/POST /api/attribution/models`
  - `GET/PATCH /api/attribution/config`
  - `GET/POST /api/attribution/conversion-events`
  - `GET /api/attribution/results`
  - `GET /api/attribution/explain/[id]`
  - `GET/PATCH /api/attribution/disputed`
  - `PATCH /api/attribution/disputed/[id]`
  - `POST /api/attribution/override` — manual override with superseding chain
  - `POST /api/attribution/conversion-events/[id]/reverse` — tombstones results
- **Inngest functions**
  - `attribution-recompute` — fires on `identity/cluster.merged`, recomputes all active conversion events for the merged cluster
  - `attribution-rollup` — nightly cron (3am), rolls up attribution metrics
- **UI pages** — `/attribution`, `/attribution/[id]`, `/attribution/disputed`

#### Spec 05 — Site Visit Event Integration
- **DB tables** — `mih.site_visit_events`, `mih.portal_site_visit_targets`, `mih.site_visit_attribution_log` (migration 019)
- **Consumer module** — `src/modules/site-visits/consumer.ts`  
  - Idempotent by `crm_event_id`  
  - Handles: `scheduled`, `completed`, `no_show`, `walk_in_unscheduled`  
  - Creates `conversion_events` for `site_visit_completed` and triggers attribution  
- **Portal SLA** — `src/modules/site-visits/portal-sla.ts`  
  - Breached when pacing ratio < 0.80  
- **APIs**
  - `GET/POST /api/site-visits`
  - `GET/POST /api/site-visits/portal-targets`
  - `POST /api/inbound/crm/site-visit` — HMAC-SHA256 verified CRM webhook
- **UI page** — `/site-visits`

#### Spec 06 — Project-Level Marketing Operations
- **DB tables** — `mih.projects` (with `fy_marketing_budget` as generated column = `fy_booking_target_value × marketing_spend_pct`), `mih.project_source_allowlist`, `mih.project_stage_history`, `mih.project_source_history` (migration 020)
- **Stage automation** — `src/modules/projects/stage-automation.ts`  
  - `pre_launch → launch` auto-enables: `tv_ads`, `newspaper`, `theatre`, `influencer`  
  - Sets `auto_disable_at = launch_date + 60 days` for each  
- **Inngest function** — `project-source-autodisable` — daily cron (1am), disables `project_source_allowlist` rows where `auto_disable_at < now()`
- **APIs**
  - `GET/POST /api/projects`
  - `GET/PATCH /api/projects/[id]` — stage change triggers automation
  - `GET /api/projects/[id]/sources`
  - `GET /api/projects/[id]/predominant-source`
  - `POST /api/inbound/crm/project` — HMAC-SHA256 verified CRM project sync
- **UI pages** — `/projects`, `/projects/[id]`

### Known Gap (v2.3 backlog)
- `GET /api/attribution/conversion-events/[id]` — individual conversion event lookup endpoint missing

---

## v2.1 — Phase 2 Gap Fixes
**Released:** 2026-05-21 (earlier in session)  
**Merged PR:** #8  

- Wired `runAttributionForConversionEvent` end-to-end from consumer → runner  
- Fixed `project_stage_history` schema: added `from_stage`/`to_stage`/`occurred_at` columns  
- `PATCH /api/projects/[id]` stage change now triggers source allowlist automation  
- Fixed `attribution_results` partial unique index for superseded-chain idempotency  

---

## v2.0 — Phase 2 Foundation
**Released:** 2026-05-21 (earlier in session)  
**Merged PR:** #7  

Initial Phase 2 scaffold: Specs 04, 05, 06 — all DB migrations, core modules, API routes, UI pages. First-touch attribution engine pure functions, site visit consumer, project entity.

---

## v1.0 — Phase 1: Taxonomy, Ingestion, Identity
**Released:** 2026-05-21 (earlier in session)  

Specs 01, 02, 03: source taxonomy, lead ingestion pipeline, identity dedup graph, connector framework, RBAC, multi-tenancy RLS.
