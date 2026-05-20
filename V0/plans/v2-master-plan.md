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
| 05 | Site Visit Event Integration | CRM event consumer + portal SLA tracking | 7 d | Phase 2 | Not started — spec pending upload |
| 06 | Project-Level Marketing Ops | Project entity + per-project economics + stage rules | 8 d | Phase 2 | Not started — spec pending upload |
| 07 | Budget Planning Engine | FY → Q → M → W decomposition + dynamic reallocation | 16 d | Phase 3 | Not started — spec pending upload |
| 08 | Channel Partner Management | CP registry + push API + 2.5% commission engine | 18 d | Phase 3 | Not started — spec pending upload |
| 09 | Referral Program | Existing-customer referrals + 1.5% commission + re-engagement | 14 d | Phase 3 | Not started — spec pending upload |
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

### Specs 05 & 06 — Pending Upload
> Specs 05 (Site Visit Event Integration) and 06 (Project-Level Marketing Ops) will be planned once uploaded.
> 
> Per Spec 00: Spec 06 can start in parallel with Spec 04 once Spec 03 lands. Spec 05 has light dependency on Spec 04.

---

## 5. Phase 3 & 4 — Pending Upload
> Specs 07–11 will be planned once uploaded.
> Per Spec 00: Specs 07, 08, 09 can develop in parallel once Spec 04 + Spec 06 land.

---

## 6. Milestones & Demo Gates (Spec 00 §6)

These are HARD go/no-go gates. If a demo fails, **stop adding scope and stabilize.**

| Demo | Goal | Pass Criteria |
|---|---|---|
| **D1: Lead landed** (W6) | Lead arrives, deduped, golden record built | A lead from Meta + a duplicate from 99acres become one cluster within 1s |
| **D2: Attribution works** (W11) | First-touch + household + CP-claim block all firing | Manual test of 5 scenarios passes; comparison-model view renders |
| **D3: Operational verticals work** (W18) | CP commission + Budget plan + Referral all functional | CMO can create plan; CP can push lead and see commission status; Referrer can submit and see reward |
| **D4: V1 ready** (W22) | End-to-end with design partner builder | Real builder uses MIH for 1 week without engineering hand-holding |

---

## 7. Scope Cuts If Timeline Slips (Spec 00 §8 — in order)

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

## 8. Risk Register (Spec 00 §7 — key items)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Attribution disputes from CPs spiral after launch | High | High | CP-visible dispute queue + ops SLA + clear rule explanation (Spec 08) |
| Identity resolution false positives cause credit disputes | Medium | High | Deterministic-only in V0; fuzzy as opt-in with confidence threshold |
| Builder team's marketing taxonomy is too chaotic | High | Medium | Spec 01's tenant extension feature; consulting at onboarding |
| Telephony providers' APIs are inconsistent | Medium | Medium | Ship Exotel first; CSV import as universal fallback |
| Engineering pace slips on critical path | Medium | High | Build buffer in Phase 4; scope-cut readiness per §8 |

---

## 9. v2 Build Slot Order (derived from Spec 00 §4)

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

## 10. Schema Migration Strategy

The v2 implementation introduces new `mih.*` namespaced tables alongside existing tables. Migration approach:

| Action | Rationale |
|---|---|
| Rename `raw_leads` → `mih.raw_inbox` (or add `mih.raw_inbox` as new primary) | Spec 02 uses `raw_inbox` with a different schema; `source_received_at` is critical for attribution |
| Add `mih.sources` (full hierarchy) alongside existing `sources` | Existing `sources` becomes legacy; new hierarchy uses LTREE |
| Add `mih.golden_records` as authoritative attribution anchor | Spec 03 `first_touch_*` fields are the input to Spec 04 |
| Keep existing `attribution_rollups` as V1 legacy data | New `mih.attribution_results` replaces this |
| All new tables in `mih` schema | Clean namespace separation |

---

## 11. What This Gets You (Spec 00 §11 — the founder view)

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

## 12. Deviation Tracking

Any implementation decision that deviates from the spec documents must be logged here:

| # | Where | What the spec says | What we're doing differently | Reason | Approved by |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

*This table must be populated before any deviation is committed.*

---

*Last updated: v2 draft — Specs 01–04 locked. Specs 05–11 pending upload from Raghava.*
