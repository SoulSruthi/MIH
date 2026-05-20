# MIH v2 — Master Implementation Plan

**Authority:** Spec 00 (Implementation Plan) + Specs 01–11 (companion specs)  
**Status:** DRAFT — Specs 01–04 locked; Specs 05–11 TBD (pending upload)  
**Branch:** `claude/draft-v2-plan-tTvL1`  
**Rule:** Execute EXACTLY as described in the spec documents. Any deviation must be flagged and confirmed.

---

## 0. Governing Principles (from Spec 00 §9)

| Practice | How |
|---|---|
| Spec-driven | Every PR references the spec section it implements |
| Event-first | Cross-module communication is always via events, never direct DB reads |
| Audit-everything | Every state change writes to its module's audit table |
| Idempotency | All ingestion endpoints + event consumers are idempotent |
| Schema migrations | Forward-compatible; never break older clients |
| Multi-tenancy enforcement | Every query filters by `org_id`; centralized in repository layer |

---

## 1. The 11 Specs at a Glance (Spec 00 §1)

| # | Spec | Domain | Effort | Phase | Status |
|---|---|---|---|---|---|
| 01 | Source & Channel Taxonomy | Foundational vocabulary + telephony number registry | 8 d | Phase 1 | **Partial** — basic sources table exists; hierarchy, activities, tracking_numbers missing |
| 02 | Lead Ingestion | Multi-source connector framework + raw_inbox | 18 d | Phase 1 | **Partial** — Meta/Google/portals exist; telephony, CP push, WhatsApp, CSV-mapper missing |
| 03 | Identity Resolution | Dedup + family/household clustering + golden records | 15 d | Phase 1 | **Partial** — phone dedup exists; household clustering, golden records, fuzzy dedup missing |
| 04 | Attribution Engine | First-touch + household + CP-claim block + overrides | 14 d | Phase 2 | **Rebuild** — current model is last-touch; spec requires first-touch as operational |
| 05 | Site Visit Event Integration | CRM event consumer + portal SLA tracking | 7 d | Phase 2 | Not started |
| 06 | Project-Level Marketing Ops | Project entity + per-project economics + stage rules | 8 d | Phase 2 | Not started |
| 07 | Budget Planning Engine | FY → Q → M → W decomposition + dynamic reallocation | 16 d | Phase 3 | Not started |
| 08 | Channel Partner Management | CP registry + push API + 2.5% commission engine | 18 d | Phase 3 | Not started |
| 09 | Referral Program | Existing-customer referrals + 1.5% commission + re-engagement | 14 d | Phase 3 | Not started |
| 10 | ROI Reporting | CPB-anchored dashboards + spend + plan-vs-actual variance | 16 d | Phase 4 | **Partial** — basic ROI dashboard exists; CPB-anchor, variance, comparison models missing |
| 11 | Manual Reconciliation | Disputed queue + Salesforce import + comment parsing | 12 d | Phase 4 | Not started — spec pending upload |

**Total spec effort:** ~146 dev-days  
**Existing implementation reuse:** ~30–40% (foundation, connectors, basic dedup)

---

## 2. Dependency Graph (Spec 00 §2)

```
PHASE 1 — FOUNDATION
  01 Source Taxonomy ──────┐
                           ├──> 02 Lead Ingestion ──> 03 Identity Resolution
  (Multi-tenancy, RBAC) ───┘

PHASE 2 — ATTRIBUTION CORE
  03 Identity ──┐
                ├──> 04 Attribution Engine
  02 Ingestion ─┘        │
                         ├──> 05 Site Visit Integration
  06 Project Ops ────────┘ (in parallel; light dep)

PHASE 3 — OPERATIONAL MODULES
  04 Attribution ──┬──> 07 Budget Planning
  06 Project Ops ──┤
                   ├──> 08 CP Management
                   └──> 09 Referral Program

PHASE 4 — INTELLIGENCE + RECONCILIATION
  04+05+06+07+08+09 ──> 10 ROI Reporting
  02+03+04+08+09 ─────> 11 Manual Reconciliation
```

**Critical path: 01 → 02 → 03 → 04** — nothing else functions without these four.

**Do NOT start:**
- Spec 04 until Spec 03 V0 lands (deterministic dedup is enough to start)
- Specs 07/08/09 until Spec 04 V0 lands
- Spec 10 can start after Spec 04 + Spec 06 land

---

## 3. Phase 1 — Foundation

### Spec 01 — Source & Channel Taxonomy (8 days)
**Spec doc:** `01-source-channel-taxonomy.md`  
**Blocks:** Spec 02 (Lead Ingestion), Spec 04 (Attribution), Spec 10 (ROI)

#### What the spec requires (exact):
- **7-level hierarchy:** channel → medium → source → sub_source → campaign → ad_creative → placement
- **`mih.sources`** with LTREE path, `is_platform_managed`, lifecycle states: `active|launch_only|paused|killed`, `launch_only_for_project_ids[]`
- **`mih.activities`** — concrete BTL/offline activities (hoarding, event, signage, theatre, etc.) with QR code generation + `form_id` link
- **`mih.tracking_numbers`** — DNI from existing telephony providers, E.164 format, state: `assigned|released|reserved`
- **`mih.telephony_connections`** — Exotel first (most common Indian RE), then Knowlarity/MyOperator/Servetel
- Pre-seeded ~80 Indian RE catalog sources (locked, `is_platform_managed=true`)
- Tenant extensions under `custom.*` namespace
- Number recycling with 90-day cooldown
- Events emitted: `source.created`, `source.lifecycle_changed`, `activity.created`, `activity.ended`, `tracking_number.assigned`, `tracking_number.released`

#### Gap vs current:
- Current `sources` table: simple connector mapping, no hierarchy, no LTREE, no lifecycle states
- **Missing entirely:** `activities`, `tracking_numbers`, `telephony_connections`
- **Missing:** pre-seeded RE catalog, tenant extension pattern, QR generation

#### Build phases (per spec):
| Phase | Capabilities | Effort |
|---|---|---|
| V0 | Seeded taxonomy (read-only), 3-level browsing, activity CRUD without QR/number | 3 days |
| V1 | Tenant extensions, lifecycle state machine, tracking number registry, Exotel connector | 4 days |
| V1.5 | Knowlarity + MyOperator + Servetel connectors, number recycling cron | 1 day |
| V2 | AI-suggested taxonomy refinement | OUT OF SLOT |

#### Acceptance criteria (from spec — do not deviate):
- Org admin sees pre-seeded RE source tree on first login with all 80 default sources
- Marketing ops can mark "TV Ads — Sun TV" as launch-only for Project Alpha
- Ops can create BTL activity "Hoarding - OMR Junction" with start/end dates, assign tracked number from Exotel
- QR code auto-generated on activity creation, links to digital lead form
- Inbound call to tracked number resolves to source + activity + project in <100ms
- Killing a source does NOT delete historical leads attributed to it
- Cannot delete a platform-managed source

---

### Spec 02 — Lead Ingestion (18 days)
**Spec doc:** `02-lead-ingestion.md`  
**Depends on:** Spec 01  
**Blocks:** Spec 03 (Identity Resolution), Spec 04 (Attribution)

#### What the spec requires (exact):
- **`mih.connectors`** — registered source integrations with KMS-encrypted config, health state: `healthy|degraded|failed`
- **`mih.raw_inbox`** — append-only landing table. NOT `raw_leads`. Fields: `external_id`, `source_received_at` (for attribution windowing), `raw_payload` + `normalized` JSONB, `processing_state: pending|normalized|dedup_queued|rejected|manual_review`, `manual_review_flag`
- **`mih.connector_health_events`** — health event log
- **`mih.webform_templates`** — for builder website + QR forms, `form_slug` public-facing path
- Connectors required: Meta Lead Ads, Google Ads, 99acres, MagicBricks, Housing.com, NoBroker, Roof & Floor, Common Floor; webform; telephony inbound; CP push; manual entry; CSV bulk import
- **Manual call rejection rule:** sales-rep-claimed calls without tracking number → `manual_review_required`
- Inbound APIs: `/api/inbound/webhook/meta`, `/api/inbound/webhook/google`, `/api/inbound/webhook/:portal_slug`, `/api/inbound/webhook/telephony/:provider`, `/api/inbound/cp/:cp_id/leads`, `/api/inbound/forms/:form_slug`, `/api/inbound/manual`, `/api/inbound/csv`
- Events: `lead.raw_ingested`, `lead.normalized`, `lead.rejected`, `lead.manual_review_required`, `connector.health_degraded`, `connector.auth_expired`

#### Gap vs current:
- Current `raw_leads` table: different schema — missing `source_received_at`, `manual_review_flag`, `processing_state` as spec defines it
- **Missing connectors:** NoBroker, Roof & Floor, Common Floor, telephony inbound (Exotel webhook), CP push endpoint, WhatsApp inbound
- **Missing:** webform templates, manual call rejection rule, CSV column-mapper UI
- Existing portal connector pattern is reusable for new portals

#### Build phases (per spec):
| Phase | Capabilities | Effort |
|---|---|---|
| V0 | Connector framework + raw_inbox + 1 connector (Meta) + universal webform endpoint | 6 days |
| V0.5 | CSV import with column-mapper UI | 2 days |
| V1 | +5 portal connectors (99acres, MagicBricks, Housing.com, NoBroker, Roof & Floor) + Google Ads + Telephony inbound | 7 days |
| V1.5 | WhatsApp inbound + CP push + manual entry mobile UI | 3 days |
| V2 | AI-based payload normalization for unknown CSV formats | OUT OF SLOT |

#### Acceptance criteria (from spec — do not deviate):
- New Meta Lead Form connected via OAuth in <2 minutes
- Webhook from Meta hits raw_inbox within 1s of customer form submission
- Each raw lead has `source_id`, `activity_id` (if applicable), `project_id` resolved or explicit null with reason
- Inbound call to tracked number creates raw_inbox row with phone + source + activity within 2s
- CSV upload of 10K rows completes in <60s with row-level error report
- Connector marked degraded after 5 consecutive failures; alert sent to ops
- Sales-rep manual call claim with no tracked call lands in manual_review queue, NOT auto-attributed
- No data loss across connector restarts (verified via 24h chaos test)

---

### Spec 03 — Identity Resolution (15 days)
**Spec doc:** `03-identity-resolution.md`  
**Depends on:** Spec 02  
**Blocks:** Spec 04 (Attribution), Spec 07 (CP Management), Spec 08 (Referral)

#### What the spec requires (exact):
- **`mih.identity_nodes`** — atomic identity attributes: `phone|email|name|alt_phone` with confidence scores
- **`mih.identity_clusters`** — canonical groups, `cluster_type: individual|household|suspect`, `state: active|merged_into|split`
- **`mih.identity_edges`** — links with `edge_type: deterministic|fuzzy|household|manual`, confidence, `reversed_at` for unmerge
- **`mih.golden_records`** — projection for downstream; CRITICAL fields: `first_touch_raw_lead_id`, `first_touch_source_id`, `first_touch_at` — these are the attribution anchor for Spec 04
- **`mih.link_events`** — append-only audit log for all merge/unmerge/household-link operations
- **`mih.dedup_rules_config`** — per-tenant: `dedup_window_days` (default 60), `fuzzy_name_threshold` (0.85), `household_clustering_enabled`, `household_window_days` (30)
- **Deterministic dedup (V0):** exact phone (E.164) + exact email match within window
- **Fuzzy dedup (V1):** Jaro-Winkler name similarity ≥0.85, Levenshtein phone ≤2; auto-merge ≥0.90; manual review 0.70–0.90; new cluster <0.70
- **Family/household clustering (THE Indian RE special):** Alt-phone match, same surname + address + window, manual flag by ops. DON'T merge into one cluster — keep separate identities, link via `edge_type='household'`, update `golden_record.household_members`
- **Manual merge/unmerge** with full `link_events` audit trail + replay on unmerge
- Events: `identity.cluster_created`, `identity.cluster_merged`, `identity.household_linked`, `identity.cluster_unmerged`, `identity.golden_updated`, `identity.manual_review_needed`

#### Gap vs current:
- Current `identity_clusters` + `identity_identifiers`: covers basic dedup
- **Missing entirely:** `identity_nodes`, `identity_edges`, `golden_records`, `link_events`, `dedup_rules_config`
- **Missing:** household clustering algorithm, fuzzy dedup, first_touch anchor maintenance
- **Critical gap:** No `golden_record.first_touch_*` fields — these are required before Spec 04 can work

#### Build phases (per spec):
| Phase | Capabilities | Effort |
|---|---|---|
| V0 | Deterministic dedup on phone + email, basic cluster + golden record, no fuzzy, no household | 5 days |
| V1 | Fuzzy dedup, manual review queue, manual merge/unmerge UI, household clustering V1 (alt_phone rule) | 7 days |
| V1.5 | Suspect detection, dedup_stats dashboard, configurable rules per tenant | 3 days |
| V2 | ML-based fuzzy matching with embeddings, AI household inference from call notes | OUT OF SLOT |

#### Acceptance criteria (from spec — do not deviate):
- Same phone across 5 sources → 1 cluster, 5 source_count, 5 raw_leads
- Wife's form-fill with `alt_phone = husband's phone` → household-linked, NOT merged
- Spec 04 receives `first_touch_source_id` within 1s of new raw_lead arrival
- Manual merge creates audit row + reversal possible
- Fuzzy match below 0.70 confidence does NOT auto-merge
- Dedup window respected: dupe at day 31 with window=30 → new cluster
- CRM receives `identity.cluster_merged` event with sufficient info to update its `lead_id` mapping
- Dedup stats dashboard shows: % dupes per source per month

---

## 4. Phase 2 — Attribution Core

### Spec 04 — Lead Credit & Attribution Engine (14 days)
**Spec doc:** `04-attribution-engine.md`  
**Depends on:** Spec 02 (Ingestion), Spec 03 (Identity Resolution)  
**Blocks:** Spec 07 (CP Commission), Spec 08 (Referral), Spec 10 (ROI)

> **WARNING:** The current implementation uses LAST-TOUCH attribution. Spec 04 mandates FIRST-TOUCH as the operational model. This is a fundamental rebuild of the attribution module. Do not deviate from this.

#### The core rule (from spec — exact):
> "Within defined timeframe of the company from lead generation to booking confirmation, whatever source of marketing generates the same lead, the initial source will get the full credit."

**Two critical overrides:**
1. **Family rule** — source that brought the FIRST household member wins, even if booking is in the other person's name
2. **CP-claim block** — CP pushes lead already in system from Online source within window → CP does NOT get credit (dispute queue)

#### What the spec requires (exact):
- **`mih.attribution_models`** — versioned model registry with `is_operational` + `is_comparison` flags
- **`mih.attribution_config`** — per-tenant: `operational_model_id`, `conversion_window_days` (default 60), `household_rule_enabled`, `cp_claim_block_rule_enabled`, `cp_claim_grace_minutes` (default 0), `manual_override_allowed`, `recompute_on_unmerge`
- **`mih.conversion_events`** — what we attribute to: `lead_received|contacted|qualified|site_visit_scheduled|site_visit_completed|deal_created|deal_won|deal_lost`
- **`mih.attribution_results`** — model output with `weight`, `reason`, `computation_inputs` (snapshot for explainability), `superseded_by_id`
- **`mih.disputed_attributions`** — feeds Spec 11; state: `open|in_review|resolved|escalated`
- **Attribution explanation API:** `/api/attribution/explain/:conversion_event_id` — full reasoning trace
- **Re-attribution on cluster mutations** (merge/unmerge/household-link)
- **Re-attribution on conversion reversal** (booking cancellation)
- **Comparison models** (V1): last-touch + time-decay stored alongside first-touch; UI toggle; only operational model drives Spec 07/08/10

#### Core workflows (per spec — exact):
1. **First-touch attribution:** On `deal_won` → load golden_record → find all raw_leads in cluster within window → sort by `source_received_at` ASC → pick earliest → apply CP-claim block → apply household rule → write result
2. **CP-claim block:** If first_touch is CP source → check for earlier non-CP source in cluster within window → if exists AND time gap > `cp_claim_grace_minutes` → CP blocked → use non-CP source → emit `attribution.disputed`
3. **Household first-member rule:** Walk household-linked clusters → build combined touchpoint list → sort globally → if earliest touchpoint is NOT in converting cluster → attribute to that cluster's source
4. **Recomputation on cluster mutation:** On `identity.cluster_merged` → re-run attribution for all conversion_events of affected clusters → mark old results `superseded_by_id`
5. **Conversion reversal:** On `crm.deal_won_reversed` → mark `conversion_event.reversed_at` → mark attribution_results superseded → emit `attribution.reversed` → downstream subtracts from rollups

#### Gap vs current:
- Current `attribution_rollups`: pre-aggregated last-touch; needs to be rebuilt as first-touch operational
- **Missing entirely:** `attribution_models`, `attribution_config`, `conversion_events`, `attribution_results`, `disputed_attributions`
- **Missing:** explanation API, household rule, CP-claim block, recomputation on mutations, comparison models

#### Build phases (per spec):
| Phase | Capabilities | Effort |
|---|---|---|
| V0 | First-touch model, deterministic, single model only, no household rule | 5 days |
| V1 | Household first-member rule, CP-claim block rule, manual override, dispute queue, comparison models (last-touch + time-decay) | 6 days |
| V1.5 | Recompute-on-mutation pipeline, conversion reversal handling | 3 days |
| V2 | Custom rule DSL, AI explanation in natural language | OUT OF SLOT |

#### Acceptance criteria (from spec — do not deviate):
- Online lead day 1 + CP push day 30 → Online wins (first-touch)
- Same scenario but online lead day 1 + CP push day 61 (window=60) → CP wins (online outside window)
- Wife's form day 1, husband's form day 5 (household-linked), booking day 40 → wife's source wins
- CP pushes lead that was online 2 hours prior with `cp_claim_grace_minutes=0` → CP blocked, online wins, dispute logged
- Manual override creates new `attribution_result`, prior marked superseded
- Cluster merge across 2 prior conversions triggers re-attribution
- `/api/attribution/explain` returns: candidate touchpoints list, rule applied, why this won
- Booking cancellation reverses attribution and CP commission accrual within 1 minute
- Comparison models show last-touch and time-decay alongside first-touch for any conversion

---

### Spec 05 — Site Visit Event Integration (7 days)
**Spec doc:** `05-site-visit-event-integration.md`  
**Depends on:** Spec 04 (Attribution Engine), CRM lifecycle event system  
**Blocks:** Spec 10 (ROI — site visit is the primary funnel conversion in Indian RE)

> The site visit is the most important mid-funnel conversion in Indian RE. Credit gets validated when the site visit happens — not at form-fill (too early), not at booking (too lagged). MIH consumes CRM site-visit events, creates conversion events, triggers Spec 04 attribution, and feeds dashboards. Scheduling, cab booking, and calendar all stay in the CRM.

#### What the spec requires (exact):
- **`mih.site_visit_events`** — projection of CRM events; `event_kind: scheduled|rescheduled|cab_dispatched|customer_en_route|completed|no_show|cancelled|walk_in_unscheduled`; `is_fast_track`, `is_walk_in`, `cab_booked`; idempotency via `UNIQUE (org_id, crm_event_id)`
- **`mih.portal_site_visit_targets`** — monthly SLA targets per source/project (e.g. "99acres must deliver 20 site visits this month")
- **`mih.site_visit_attribution_log`** — materialized view joining `site_visit_events × attribution_results` for single-query "site visits by source" dashboards
- **Consumed events (4 critical):** `crm.lead.site_visit_scheduled` → create conversion_event + trigger attribution; `crm.lead.site_visit_completed` → THIS is where credit locks; `crm.lead.site_visit_cancelled` → do NOT reverse attribution (still a touchpoint); `crm.lead.walk_in_unscheduled` → if no prior MIH cluster → Spec 11 reconciliation queue
- **Portal SLA monitoring:** daily cron checks pacing; if <80% of linear pace → emit `mih.portal_target.breached` → notify marketing manager
- **Fast-track flagging:** `is_fast_track=true` from CRM propagates to dashboards ("fast-track conversions by source — measures source quality")
- Events emitted: `mih.site_visit.recorded`, `mih.site_visit.unmatched_walk_in`, `mih.portal_target.breached`

#### Key workflows (per spec — exact):
1. **Standard SV scheduled:** CRM emits → MIH verifies HMAC → resolves `cluster_id` from CRM handoff mapping → creates `site_visit_event` + `conversion_event(site_visit_scheduled)` → triggers Spec 04
2. **SV completed (credit lock-in):** CRM emits `site_visit_completed` → Spec 04 runs → if first_touch is CP and online-first existed → CP block rule fires here
3. **Walk-in with no prior MIH lead:** CRM emits `walk_in_unscheduled` → MIH looks up cluster by phone → if no match → `mih.site_visit.unmatched_walk_in` → Spec 11 queue → ops manually assigns source (nearby hoarding? untracked call? → `walk_in_unknown` fallback)
4. **Portal SLA monitoring:** online team sets monthly target; daily cron computes MTD; pacing alert fires at <80% linear pace

#### Build phases (per spec):
| Phase | Capabilities | Effort |
|---|---|---|
| V0 | CRM webhook consumer, site_visit_events table, conversion_event creation, attribution trigger for scheduled+completed | 3 days |
| V1 | Portal target setting + compliance dashboard, unmatched-walk-in reconciliation queue, fast-track flagging | 3 days |
| V1.5 | Cab dispatched event handling, no-show-rate-per-source, materialized view refresh job | 1 day |
| V2 | Predictive site-visit-to-booking conversion model per source | OUT OF SLOT |

#### Acceptance criteria (from spec — do not deviate):
- CRM emits `site_visit_scheduled` → MIH receives, attributes, dashboard updates within 5 seconds
- Site visit completed triggers Spec 04 attribution and writes result for that conversion event
- Walk-in with no prior MIH lead creates reconciliation queue item, NOT auto-attributed
- Portal target dashboard shows target vs actual, with projected end-of-month
- Duplicate CRM event delivery is idempotent (3x retry test)
- Fast-track flag propagates from CRM event to MIH dashboards
- Cancelled visits don't reverse attribution but appear in cancellation-rate-per-source metric

---

### Spec 06 — Project-Level Marketing Operations (8 days)
**Spec doc:** `06-project-level-marketing-operations.md`  
**Depends on:** Multi-tenancy foundation, Spec 01 (Source Taxonomy)  
**Blocks:** Spec 07 (Budget Planning), Spec 08 (CP Management), Spec 09 (Referral Program), Spec 10 (ROI)

> Everything in Indian RE marketing operates at the project level. A builder running 4 projects can't pool budgets or analytics. This domain owns the project entity in MIH (CRM is system of record — MIH adds marketing-specific fields) and the per-project marketing economics. The 2% spend rule lives here.

#### What the spec requires (exact):
- **`mih.projects`** — MIH's projection of the CRM project entity. Key fields: `avg_sqft`, `price_per_sqft`, `avg_ticket_value`; `fy_booking_target_count`, `fy_booking_target_value`; `marketing_spend_pct` (default 0.02); `fy_marketing_budget GENERATED ALWAYS AS (fy_booking_target_value * marketing_spend_pct) STORED`; `lifecycle_stage: pre_launch|launch|mid_construction|near_handover|handover_complete`; `marketing_manager_user_id`
- **`mih.project_source_allowlist`** — which sources are active per project per stage. `applicable_stages[]`, `auto_disable_at` (e.g. TV Ads auto-disable 60d post-launch), `enabled`
- **`mih.project_stage_history`** — audit trail of every stage transition
- **`mih.project_source_history`** — materialized view: `attribution_results × conversion_events` grouped by `(project, source, fy_year, event_code)`. **Powers Spec 07 "split budget by past-trend" calculation.**
- **Stage-based source automation:** transition to `launch` → TV/Newspaper/Theatre/Influencer sources auto-enable with `auto_disable_at = launch_date + 60d`
- **Predominant source API:** `/api/projects/:id/predominant-source?event_code=deal_won&periods=12` — ranked list by bookings and allocated value; feeds Spec 07 auto-allocate
- **2% spend rule:** `marketing_spend_pct` configurable per project; CMO override allowed; generated `fy_marketing_budget` auto-recomputes on change
- Events: `project.created`, `project.stage_transitioned`, `project.economics_updated`, `project.source_allowlist_updated`

#### Build phases (per spec):
| Phase | Capabilities | Effort |
|---|---|---|
| V0 | Projects table, CRM sync, basic economics fields, manual stage transitions | 3 days |
| V1 | Stage-based source allowlist auto-toggle, predominant source view, project_source_history materialized view | 4 days |
| V1.5 | Auto-disable cron, stage history audit, manager-assignment workflow | 1 day |
| V2 | AI-suggested spend pct + source mix per stage | OUT OF SLOT |

#### Acceptance criteria (from spec — do not deviate):
- New project synced from CRM creates `mih.projects` within 2s of CRM event
- Marketing manager transitions Project Alpha from `pre_launch` to `launch` → TV/Newspaper sources auto-enabled with 60d auto-disable
- `/api/projects/:id/predominant-source` returns ranked list within 500ms (cached materialized view)
- `fy_marketing_budget` auto-recomputes when target or `spend_pct` changes
- Stage history maintained for audit
- Killing a source at org level removes it from all project allowlists
- Active projects with no manager assigned surface in CMO dashboard as warning

---

## 5. Phase 3 — Operational Modules

### Spec 07 — Top-Down Budget Planning Engine (16 days)
**Spec doc:** `07-budget-planning-engine.md`  
**Depends on:** Spec 06 (Project-Level Marketing Ops), Spec 04 (Attribution — for past-trend data), Spec 10 (ROI)  
**Blocks:** Spec 10 (ROI — variance against plan)

> This is the second wedge of MIH — the differentiator that turns MIH from a measurement tool into the marketing brain. No Indian RE marketing tool does this today. Takes a builder's FY revenue target and decomposes it to Quarter → Month → Week, with per-project and per-source allocation based on past trend. Continuously updated with monthly true-ups.

#### What the spec requires (exact):
- **`mih.budget_plans`** — top-level plan entity; state: `draft|in_review|approved|active|superseded|archived`; `plan_code` (e.g. 'FY2026-27'); `total_booking_target_value`, `default_spend_pct`, `total_marketing_budget` (stored for stability); approval workflow with `approved_by`, `superseded_by_id`
- **`mih.budget_plan_periods`** — time decomposition: `period_kind: quarter|month|week`; `is_locked: TRUE` once period starts; locked periods cannot be edited without override flag + admin permission
- **`mih.budget_allocations`** — the per-project × medium × source × period breakdown. `medium: online|btl|cp|referral|portals|branding|walk_in`; `allocation_basis: past_trend|manual|launch_boost|scenario`. Unique per `(plan_id, period_id, project_id, medium, source_id, activity_id)`
- **`mih.budget_plan_versions`** — immutable version history for mid-FY rebalances; `reason: mid_fy_rebalance|project_added|target_revised`
- **`mih.budget_actuals`** — running pacing for variance: `bookings_count_actual`, `bookings_value_actual`, `spend_actual`; refreshed on every `attribution.assigned` event
- **Auto-decompose:** FY total → 4 quarters → 12 months → 52 weeks (seasonally weighted, configurable; default flat)
- **Auto-allocate by past-trend:** reads `mih.project_source_history` (from Spec 06); splits budget across projects then within project by medium proportionally to prior-FY contribution
- **Approval workflow:** draft → in_review → approved → active; CMO sign-off required; previous plan superseded on activation
- **Monthly true-up:** automated; computes actuals vs plan; if variance ±15% → emit `budget.rebalance_recommended`; new plan version on rebalance (CMO approval required)
- **Scenario planning:** clone + edit + compare (never activated; planning artifact only)
- Events: `budget.plan_approved`, `budget.plan_activated`, `budget.period_pacing_alert`, `budget.allocation_changed`, `budget.rebalance_recommended`

#### Key workflows (per spec — exact):
1. **FY plan creation:** POST plan → auto-decompose Q/M/W → auto-allocate across projects using past-trend from Spec 06 → ops reviews/overrides → CMO approves → activate
2. **Monthly true-up:** end of month → compute actuals → if variance ±15% → rebalance recommendation → CMO approval → new plan version
3. **Past-trend computation:** reads `mih.project_source_history` for prior FY; sums `allocated_value` by medium for `deal_won`; computes percentage shares; fallback to "typical Indian RE mix" for new tenants
4. **Scenario planning ("what if"):** clone plan → edit allocations → compare expected booking impact (using historical CPB per source) → never activate; feeds into rebalance if converted

#### Build phases (per spec):
| Phase | Capabilities | Effort |
|---|---|---|
| V0 | Plan entity + manual decomposition + manual allocation + variance dashboard read-only | 6 days |
| V1 | Auto-decompose Q/M/W, auto-allocate by past-trend, approval workflow, period locking | 6 days |
| V1.5 | Monthly rebalance recommender, scenario planning, plan versioning | 3 days |
| V2 | ML-driven optimization ("optimal mix to hit target with min spend"), automated rebalance with caps | OUT OF SLOT |

#### Acceptance criteria (from spec — do not deviate):
- CMO creates FY plan: enters ₹1000 Cr target → system auto-derives ₹20 Cr budget at 2%
- Auto-decompose generates 4 Q, 12 M, 52 W periods with correct math
- Auto-allocate uses past FY's per-project-per-medium share within ±5% accuracy
- Approval workflow: draft → review → approved → active (each step audited)
- Active plan cannot be edited; only superseded by new version
- Variance dashboard shows plan vs actual per period within 2s
- Mid-month pacing alert fires when booking <50% of target with 40% of month elapsed
- Scenario planning lets analyst clone + edit + diff against active plan without affecting actuals
- Adding new project mid-FY prompts re-allocation flow
- FY April–March (default) is configurable per tenant

---

### Spec 08 — Channel Partner (CP) Management (18 days)
**Spec doc:** `08-channel-partner-management.md`  
**Depends on:** Spec 02 (Ingestion — CP push endpoint), Spec 04 (Attribution — CP claim block rule), Spec 06 (Projects), Spec 07 (Budget)  
**Blocks:** Spec 10 (ROI — CP CPB), Spec 11 (Reconciliation — disputed CP credits)

> CPs are 30–50% of Indian RE bookings and the most operationally messy channel. The source doc: "Commission to CP is at 2.5% of booking value. Then if a CP has brought in 10 bookings for the past financial year, for the current financial year will increase the expectation to 25%+ from previous year." Per decision: CP commission lives in MIH, not PSCRM.

#### What the spec requires (exact):
- **`mih.channel_partners`** — CP registry; `cp_type: individual|firm|sub_broker`; `parent_cp_id` for sub-broker hierarchy; `default_commission_pct = 0.025` (2.5%); `rera_number`, `pan_number` (encrypted), `bank_details_encrypted`
- **`mih.cp_commission_overrides`** — per-project, per-tier custom rates; `slab_min_bookings`, `slab_max_bookings` for tiered commission (e.g. ≥5 bookings → 3%)
- **`mih.cp_api_keys`** — `api_key_hash` (bcrypt), `scopes: ['leads:write']`, `expires_at`, `revoked_at`, `last_used_at`
- **`mih.cp_lead_pushes`** — append-only push log; `outcome: accepted|dedup_existing|blocked_online_first|invalid`
- **`mih.cp_commission_accruals`** — state machine: `earned → accrued → approved → paid → reversed → disputed`; `commission_value GENERATED ALWAYS AS (booking_value * commission_pct) STORED`; `payout_reference` (external finance ref)
- **`mih.cp_fy_targets`** — past-trend-driven targets: `target = prev_fy * 1.25`; `allocated_commission_budget` feeds Spec 07 CP medium budget
- **`mih.cp_performance_summary`** — materialized view by FY: bookings_count, bookings_value, commission_total, commission_paid
- **CP-facing portal:** my leads, my commissions, my disputes; CP can see **exactly why their credit was blocked** (explanation from Spec 04)
- **FY target setting (the past-trend driver):** end of FY, automated: `target = prev_fy_bookings * 1.25`; bulk recommendations; Spec 07 picks up via `cp.fy_target_set`
- **Slab boundary rule:** commission_pct snapshot taken AT TIME of accrual creation; slab applies from that booking forward; earlier bookings locked at old rate (no retro-bump unless override)
- **Clawback rule:** if state='paid' and booking cancelled → CANNOT auto-reverse; creates "clawback request" → manual finance workflow
- Events: `cp.lead_pushed`, `cp.lead_blocked`, `cp.commission_earned`, `cp.commission_approved`, `cp.commission_paid`, `cp.commission_reversed`, `cp.fy_target_set`, `cp.performance_milestone`

#### Key workflows (per spec — exact):
1. **CP onboarding:** create via UI → assign `cp_code` (CP-NNNN sequential) → generate API key → CP gets portal account → marketing manager sets initial FY target (prev_fy * 1.25)
2. **CP lead push:** HMAC + API key auth → rate limit (100/hour) → persist `raw_inbox` (Spec 02) + `cp_lead_pushes` → Spec 03 dedup → if existing non-CP cluster in window: `outcome='blocked_online_first'` → return 202 Accepted
3. **Commission accrual:** `attribution.assigned` consumed → lookup `cp_id` → determine rate (override → slab → default 2.5%) → snapshot `commission_pct` at time of creation → `cp.commission_earned` → approval queue
4. **FY target:** end-of-FY cron → `suggested = prev_fy_bookings * 1.25` → bulk review → `cp_fy_targets` written → Spec 07 allocates expected commission outflow

#### Build phases (per spec):
| Phase | Capabilities | Effort |
|---|---|---|
| V0 | CP entity, push API + auth, basic accrual on attribution, manual approval | 7 days |
| V1 | CP portal (view leads/commissions), dispute creation, FY target setting, slab rates | 7 days |
| V1.5 | Sub-broker hierarchy, reversal workflows, performance dashboards, bulk target recommendations | 3 days |
| V2 | AI-suggested commission rates per CP, CP scorecards, predictive churn alerting | OUT OF SLOT |

#### Acceptance criteria (from spec — do not deviate):
- CP onboards via UI → gets API key → pushes lead within 5 minutes
- Authenticated CP push hits `raw_inbox` + `cp_lead_pushes` in <500ms
- CP push for already-online lead returns 202 but `cp_lead_pushes.outcome='blocked_online_first'`
- CP portal shows blocked-credit with clear explanation
- Deal won → CP credit → commission accrual created in 'earned' state within 30s
- Sales manager approval moves state to 'approved'; CP sees status update
- Booking cancellation → commission reverses if not paid; clawback flag if paid
- FY end → system recommends N+25% target for each CP within 5 minutes for org with 200 CPs
- Slab rate boundary correctly applies (5th booking gets old rate, 6th gets new)
- CP-specific commission override on Project Alpha (3.5%) wins over default 2.5%
- Top-10-CPs dashboard renders in <1s

---

### Spec 09 — Referral Program Management (14 days)
**Spec doc:** `09-referral-program.md`  
**Depends on:** Spec 02 (Ingestion), Spec 04 (Attribution), Spec 06 (Projects), Spec 07 (Budget), CRM existing-customer data  
**Blocks:** Spec 10 (ROI — referral channel CPB)

> Referrals are the cheapest, highest-quality channel in Indian RE — typically 10–20% of bookings at half the CPB of CP. Source doc: "Referral commission is 1.5% of booking value, given to existing customer who referred. Past purchasers only, with consent." Structurally mirrors Spec 08 but with referrer-specific rules (lower rate, consent-gated, customer not broker). Build with a shared base where sensible.

#### What the spec requires (exact):
- **`mih.referrers`** — existing-customer-only registry; `crm_customer_id` (system of record); `referrer_code` (short shareable, e.g. 'REF-A4B7C'); `first_booking_at` and `bookings_count` (eligibility: must have ≥1 booking); `consent_state: pending|opted_in|opted_out|revoked`; `consent_channels: ['sms','whatsapp','email']`; `default_commission_pct = 0.015` (1.5%); `reward_preference: cash|voucher|white_goods|choice`
- **`mih.referral_submissions`** — append-only; `outcome: accepted|dedup_existing|blocked_other_source_first|invalid`; `submission_channel: portal|webform|sms_reply|whatsapp|ops_manual`
- **`mih.referrer_commission_overrides`** — slab tiers; `slab_min_referrals` (e.g. ≥3 successful referrals → bumped rate)
- **`mih.referral_commission_accruals`** — mirrors Spec 08 CP accrual; same state machine: `earned → accrued → approved → paid → reversed → disputed`; `reward_kind` field per referrer preference
- **`mih.referral_campaigns`** — re-engagement orchestration; `target_segment JSONB` (filter rules); `cadence: one_time|monthly|quarterly`; `bonus_rate_override` (festive 2% for 30 days); delegates actual sending to communication service (SMS/WhatsApp/email)
- **`mih.referral_campaign_runs`** — per-execution log: `recipients_count`, `delivered_count`, `responded_count`, `conversions_count`
- **`mih.referrer_performance_summary`** — materialized view: submissions, successful referrals, bookings_value, reward_total, reward_paid by FY
- **Public submission endpoint:** `/api/inbound/forms/referral/:referrer_code` — referrer_code validates consent before accepting submission
- **Consent gate:** `NO communication to non-opted-in referrers`; consent revocation stops comms within 1 hour; existing accruals continue (consent governs comms, not payout obligations)
- **Slab tier logic:** same snapshot-at-time rule as Spec 08; no retro-bump unless explicit override
- **Past-year-trend forecast:** `GET /api/referrals/forecasts` → prior FY referral metrics × 1.25 growth → feeds Spec 07 Referral medium budget
- Events: `referrer.consent_granted`, `referrer.consent_revoked`, `referrer.referral_submitted`, `referrer.referral_blocked`, `referrer.commission_earned`, `referrer.commission_approved`, `referrer.commission_paid`, `referrer.commission_reversed`, `referrer.campaign_completed`

#### Critical distinction from Spec 08:
| | Spec 08 (CP) | Spec 09 (Referral) |
|---|---|---|
| Who | External broker | Existing customer |
| Rate | 2.5% default | 1.5% default |
| Gate | API key + HMAC | Consent (opt-in required) |
| Comms | Builder-initiated | Consent-gated only |
| Portal | CP-facing portal | Referrer-facing lightweight portal |

#### Build phases (per spec):
| Phase | Capabilities | Effort |
|---|---|---|
| V0 | Referrer registry + consent flow + manual submission API + basic accrual on attribution | 5 days |
| V1 | Public submission form, referrer portal, slab tiers, approval workflow, reward preference | 5 days |
| V1.5 | Re-engagement campaigns (with comms service integration), past-year-trend forecast, reversal flow | 3 days |
| V2 | Leaderboards, AI-suggested re-engagement timing, gamification | OUT OF SLOT |

#### Acceptance criteria (from spec — do not deviate):
- Bulk import from CRM creates referrer records for all customers with `bookings_count ≥ 1`
- Consent collection campaign moves opted-in referrers from 'pending' to 'opted_in'
- Opted-in referrer submits via public form; `raw_inbox` + `referral_submissions` row created in <1s
- Submission for friend already in CRM is correctly blocked with explanation visible in portal
- `deal_won` → referrer credit → accrual created with `reward_kind` matching referrer preference within 30s
- Slab tier upgrade at 3rd successful referral applies new rate from that referral forward
- Opt-out stops all comms within 1 hour; existing accruals unaffected
- Forecast endpoint returns expected referral channel volume + reward outflow for next FY
- Re-engagement campaign segment preview matches actual sends within ±1%
- Referrer portal renders my-referrals + rewards in <1s

---

## 6. Phase 4 — Intelligence + Reconciliation

### Spec 10 — ROI Reporting — Pending Upload
> Spec 10 will be planned once uploaded.  
> Per Spec 00: Spec 10 can start after Spec 04 + Spec 06 land. Does not need all upstream V1.

### Spec 11 — Manual Reconciliation — Pending Upload
> Spec 11 will be planned once uploaded.  
> Per Spec 00: Spec 11 can start after Spec 04 V0 lands; matures with each upstream module.

---

## 7. Milestones & Demo Gates (Spec 00 §6)

These are HARD go/no-go gates. If a demo fails, **stop adding scope and stabilize.**

| Demo | Goal | Pass Criteria |
|---|---|---|
| **D1: Lead landed** (W6) | Lead arrives, deduped, golden record built | A lead from Meta + a duplicate from 99acres become one cluster within 1s |
| **D2: Attribution works** (W11) | First-touch + household + CP-claim block all firing | Manual test of 5 scenarios passes; comparison-model view renders |
| **D3: Operational verticals work** (W18) | CP commission + Budget plan + Referral all functional | CMO can create plan; CP can push lead and see commission status; Referrer can submit and see reward |
| **D4: V1 ready** (W22) | End-to-end with design partner builder | Real builder uses MIH for 1 week without engineering hand-holding |

---

## 8. Scope Cuts If Timeline Slips (Spec 00 §8 — in order)

1. V2 features deferred — all "V2" items in each spec already deferred
2. Spec 11 V1.5 — Comment extraction AI; replace with manual ops form
3. Spec 10 V1.5 — Saved/custom reports; ship with fixed dashboards only
4. Spec 07 V1.5 — Scenario planning + monthly rebalance recommender; manual rebalance only
5. Spec 08 V1.5 — Sub-broker hierarchy; flat CP structure only at V1
6. Spec 09 V1.5 — Re-engagement campaigns; manual SMS lists exported instead
7. Spec 03 V1.5 — Suspect detection + dedup stats dashboard
8. Spec 02 V1.5 — WhatsApp inbound; defer if needed
9. One of three portals (Spec 02) can be deferred to V1.5 if needed

**DO NOT CUT (from Spec 00):**
- Spec 04 V1 (household + CP-block rules — these are the differentiator)
- Spec 07 V1 (auto-allocate by past-trend — this is the second wedge)
- Spec 10 V0 + V1 (ROI dashboards — this is the daily-use surface)
- Spec 11 V0 (disputed queue — without this, attribution disputes have no escape valve)

---

## 9. Risk Register (Spec 00 §7 — key items)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Attribution disputes from CPs spiral after launch | High | High | CP-visible dispute queue + ops SLA + clear rule explanation (Spec 08) |
| Identity resolution false positives cause credit disputes | Medium | High | Deterministic-only in V0; fuzzy as opt-in with confidence threshold |
| Builder team's marketing taxonomy is too chaotic | High | Medium | Spec 01's tenant extension feature; consulting at onboarding |
| Telephony providers' APIs are inconsistent | Medium | Medium | Ship Exotel first; CSV import as universal fallback |
| Engineering pace slips on critical path | Medium | High | Build buffer in Phase 4; scope-cut readiness per §8 |

---

## 10. v2 Build Slot Order (derived from Spec 00 §4)

Following the spec's slot pickup order adapted to existing codebase:

**SLOT 1 — Spine (critical path):**
Spec 01 V0 → Spec 02 V0 → Spec 03 V0 → Spec 04 V0 → [Spec 08] → [Spec 07] → [Spec 10]

**SLOT 2 — Integration + Operational:**
Spec 02 V1 (additional connectors) → Spec 06 → Spec 05 → [Spec 09] → [Spec 11]

**SLOT 3 — Frontend (begins when first APIs land):**
Source mgmt UI → Lead inbox UI → Cluster review UI → Attribution explain UI → Project dashboard → Budget plan UI → CP portal → Referrer portal → ROI dashboards → Reconciliation queue

**SLOT 4 — Connectors:**
Exotel → NoBroker → Roof & Floor → Common Floor → WhatsApp → Knowlarity → MyOperator → Salesforce import

**Key parallelism rules (Spec 00 §4):**
- Don't start Spec N if its blocker hasn't reached V0
- Spec 03 V0 must land before Spec 04 starts
- Spec 04 V0 must land before Specs 07/08/09 start
- Spec 10 can start after Spec 04 + Spec 06 land; doesn't need all upstream V1
- Spec 11 can start after Spec 04 V0 lands; matures with each upstream module

---

## 11. Schema Migration Strategy

The v2 implementation introduces new `mih.*` namespaced tables alongside existing tables. Migration approach:

| Action | Rationale |
|---|---|
| Rename `raw_leads` → `mih.raw_inbox` (or add `mih.raw_inbox` as new primary) | Spec 02 uses `raw_inbox` with a different schema; `source_received_at` is critical for attribution |
| Add `mih.sources` (full hierarchy) alongside existing `sources` | Existing `sources` becomes legacy; new hierarchy uses LTREE |
| Add `mih.golden_records` as authoritative attribution anchor | Spec 03 `first_touch_*` fields are the input to Spec 04 |
| Keep existing `attribution_rollups` as V1 legacy data | New `mih.attribution_results` replaces this |
| All new tables in `mih` schema | Clean namespace separation |

---

## 12. What This Gets You (Spec 00 §11 — the founder view)

After completing Specs 01–11 (v2), MIH delivers:
1. A real source taxonomy that survives builder reality
2. 15+ source integrations funneling into one canonical raw_inbox
3. Identity resolution that catches dupes including the husband-wife scenarios that destroy CP commission trust
4. **First-touch attribution with the CP-block + household rules — the rule set that matches how Indian RE actually works** (not last-touch like current V1)
5. CRM-driven site-visit attribution without owning the scheduling complexity
6. Project-aware everything — multi-project builders work properly
7. Top-down budget planning with dynamic reallocation — the second wedge
8. CP commission engine with 2.5% accrual, slab tiers, dispute resolution
9. Referral program with consent, re-engagement, 1.5% rewards
10. CPB-anchored ROI dashboards with plan-vs-actual variance and comparison-model views
11. A reconciliation backbone that handles Salesforce import + every edge case from every domain

---

## 13. Deviation Tracking

Any implementation decision that deviates from the spec documents must be logged here:

| # | Where | What the spec says | What we're doing differently | Reason | Approved by |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

*This table must be populated before any deviation is committed.*

---

*Last updated: v2 draft — Specs 01–09 locked. Specs 10–11 pending upload.*
