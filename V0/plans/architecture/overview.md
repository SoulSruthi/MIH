# MIH System Overview

**Authority:** Builtrix Labs Pvt Ltd  
**Phase:** V0 Planning  
**Status:** Approved — do not modify without an ADR

---

## What MIH Is (One Sentence)

MIH is the **marketing operations layer upstream of the Builtrix AI CRM** that ingests leads from every paid + organic source a builder spends on, deduplicates across sources, attributes downstream CRM outcomes back to source/campaign/ad/creative, and hands curated leads to the CRM via a versioned API contract.

## What MIH Is NOT (Architectural Negative Space)

| Not | Consequence for architecture |
|---|---|
| An ad-buying platform | All connectors read-only; no write permissions requested from Meta/Google |
| A CRM | No lead engagement screens, no calling, no messaging; storage profile stays small |
| A creative tool | Connectors observe creative IDs only — never manipulate them |
| A landing-page builder | Accepts lead form data via API; does not host forms |
| A BI tool with custom SQL | Semantic metric layer only (V3 may revisit) |

---

## System Topology

```
              ┌────────────────────────────────────────────────────┐
              │  MIH  (this product)                               │
              │   Ingest → Dedup → Grade → Hand off → Attribute    │
              └─────────────────┬──────────────────────────────────┘
                                │ POST /api/sister/v1/leads
                                │ Webhook ← CRM lifecycle events
                                ▼
              ┌────────────────────────────────────────────────────┐
              │  AI CRM  (built, sister app)                       │
              │   Allocate → Call → Qualify → Site visit → Deal    │
              └─────────────────┬──────────────────────────────────┘
                                │ Voice IQ event inbox
                                ▼
              ┌────────────────────────────────────────────────────┐
              │  Voice IQ  (built, sister app)                     │
              │   Record → Analyze → BANT → Intent → NBA           │
              └────────────────────────────────────────────────────┘
```

Voice IQ events do NOT flow to MIH directly. CRM emits lifecycle events to MIH. Single integration path per sister product.

---

## Infrastructure Topology

```
                  Builder org users (CMO, Manager, Analyst, Ops, Viewer)
                                           │ Browser TLS
                                           ▼
   ┌──────────────────────────────────────────────────────────────────────────────────┐
   │  Vercel — single Next.js 16 app (modular monolith)                                │
   │  ┌────────────────────────────────────────────────────────────────────────────┐  │
   │  │  app/(app)              Authenticated routes: /dashboard /sources /reports  │  │
   │  │  app/(platform)         Super-admin routes: /platform                      │  │
   │  │  app/api/inbound/*      Source ingestion (HMAC + token verified)           │  │
   │  │  app/api/crm/events     CRM lifecycle inbox (HMAC + bearer + clock)        │  │
   │  │  app/api/oauth/*        Connector OAuth callback handlers                  │  │
   │  │                                                                            │  │
   │  │  modules/  (bounded contexts; ESLint-enforced module boundaries)            │  │
   │  │   ├── tenancy/        Org + memberships + RLS helpers                      │  │
   │  │   ├── rbac/           Role + permission resolver + Upstash cache            │  │
   │  │   ├── audit/          Append-only audit log writer                         │  │
   │  │   ├── connectors/     Connector SDK + manifests + adapters                 │  │
   │  │   ├── ingestion/      Raw lead intake + normalization + validation          │  │
   │  │   ├── identity/       Identity graph + dedup engine                        │  │
   │  │   ├── leads/          Unique-lead projection + state                       │  │
   │  │   ├── crm-handoff/    Outbound delivery worker + retry + circuit breaker   │  │
   │  │   ├── crm-events/     Inbox + lifecycle event projection                   │  │
   │  │   ├── spend/          Spend ingestion (API pull + manual)                  │  │
   │  │   ├── attribution/    Pure attribution function + rollups                  │  │
   │  │   ├── analytics/      Semantic metric layer + dashboard queries (V1+)      │  │
   │  │   ├── ai/             AI gateway + agents (V2+)                            │  │
   │  │   └── billing/        Stripe subscriptions (V1+)                           │  │
   │  └────────────────────────────────────────────────────────────────────────────┘  │
   └────────┬─────────────────────────────────────────────────────────────────────────┘
            │ Supabase JS (RLS-aware JWT)
            ▼
   ┌─────────────────────────────────────┐    ┌────────────────────────────────┐
   │  Supabase (Mumbai South-Asia-1)      │    │  Inngest (event runtime)       │
   │  Auth (JWT: org_id + roles)          │    │   - source.*.poll crons        │
   │  Postgres 15+ (RLS, pgcron)          │◄───┤   - lead.ingested chain        │
   │  Storage (raw_payload archives)      │    │   - crm.handoff worker         │
   │  Realtime (live updates V1+)         │    │   - spend.daily_sync           │
   └─────────────────────────────────────┘    │   - attribution.rollup         │
            ▲                                  └──────────────┬─────────────────┘
            │ KV ops                                          │ external HTTP
   ┌──────────────────┐                        ┌─────────────▼─────────────────┐
   │ Upstash Redis    │                        │ External APIs                  │
   │  - rate limiter  │                        │  Meta Lead Ads · Google Ads    │
   │  - RBAC cache    │                        │  99acres · MagicBricks         │
   │  - idempotency   │                        │  Housing · JustDial            │
   └──────────────────┘                        │  Builtrix AI CRM (sister)      │
                                               │  Anthropic + OpenAI (V2+)     │
                                               └───────────────────────────────┘
```

---

## Why One Vercel App, Not Microservices

Forcing functions to split (don't split before any of these fires):

1. Compute profile divergence — Inngest fleet CPU/RAM fundamentally differs from request-handler fleet
2. Team count ≥ 3 distinct teams owning non-overlapping modules
3. One module dominates Postgres CPU (→ move analytics to ClickHouse first)
4. Different deploy cadence required (e.g., connectors need hourly deploys)

**V0–V2: one app. V3+: re-evaluate.**

---

## Module Boundary Enforcement

```ts
// .eslintrc
"no-restricted-imports": ["error", {
  "patterns": [
    "modules/*/data/*",           // no reaching into another module's data layer
    "modules/*/domain/!(index)*"  // no reaching into another module's internals
  ]
}]
```

Every module exposes exactly one `index.ts`. Imports from `modules/foo/index` only, never `modules/foo/data/repo`.

---

## End-to-End Data Flow (Lead Journey)

```
[Source webhook / poller]
        ↓ normalize + validate (connectors/)
        ↓ write raw_leads (immutable)  (ingestion/)
        ↓
  Inngest: mih/lead.ingested
        ↓ lookup identity_identifiers by phone_e164
        ↓ decide: unique | duplicate | merge     (identity/)
        ↓ write/update identity_clusters + unique_leads
        ↓
  Inngest: mih/lead.dedup_decided
        ↓ POST to CRM /api/sister/v1/leads       (crm-handoff/)
        ↓ write outbound_deliveries row
        ↓ update unique_leads.crm_handoff_status
        ↓
  [CRM fires lifecycle event]
        ↓ POST /api/crm/events (HMAC verified)   (crm-events/)
        ↓ write crm_lifecycle_events (immutable)
        ↓ update unique_leads.last_lifecycle_state
        ↓
  Inngest: mih/crm.event_received
        ↓ join to source/campaign/ad             (attribution/)
        ↓ recompute attribution_rollups
        ↓ dashboards reflect updated ROI
```

**Three immutable substrates** (never mutate): `raw_leads`, `crm_lifecycle_events`, `audit_log`  
**Everything else is a projection** — rebuildable from substrate on corruption or bug.
