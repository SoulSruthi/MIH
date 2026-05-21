# MIH Release Notes

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
