# MIH Plans — Master Index

**Project:** Marketing Intelligence Hub (MIH)  
**Stack:** Next.js 16 · TypeScript · Supabase (Postgres + RLS) · Inngest · Vercel (Mumbai)  
**Phases:** V0 Foundation → V1 Marketing Ops → V2 AI-Native  
**Total estimated effort:** ~113 dev-days across all phases

---

## Quick Links

| I want to... | Go to |
|---|---|
| Understand the system architecture | [Architecture Overview](architecture/overview.md) |
| See the full database schema | [Schema V0 SQL](database/schema-v0.sql) |
| Understand RLS patterns | [RLS Patterns](database/rls-patterns.md) |
| See all V0 directives | [V0 Overview](phases/v0-foundation/00-overview.md) |
| Understand CRM integration | [CRM Overview](integration/crm-integration-overview.md) |
| See what we decided and why | [Locked Decisions](decisions/locked.md) |
| See what we're NOT building | [Anti-Roadmap](decisions/anti-roadmap.md) |

---

## Architecture

| Document | Description |
|---|---|
| [architecture/overview.md](architecture/overview.md) | System topology, infrastructure, module list, end-to-end data flow |
| [architecture/principles.md](architecture/principles.md) | P1–P15 architecture principles with enforcement mechanisms |
| [architecture/stack.md](architecture/stack.md) | Full tech stack decisions, supporting services, environment variables |
| [architecture/security.md](architecture/security.md) | Defense layers, HMAC verification, credential encryption, RBAC security |

---

## Database

| Document | Description |
|---|---|
| [database/schema-overview.md](database/schema-overview.md) | Three-layer architecture, table summary, V0/V1/V2 evolution |
| [database/schema-v0.sql](database/schema-v0.sql) | Complete canonical V0 SQL schema with indexes, RLS, triggers |
| [database/rls-patterns.md](database/rls-patterns.md) | Standard RLS patterns, `app_org_id()` behavior, test templates |
| [database/indexes.md](database/indexes.md) | Index strategy, performance targets, maintenance approach |
| [database/retention.md](database/retention.md) | Retention policy, PII zeroing on org deletion, compliance notes |

---

## Multi-Tenancy & RBAC

| Document | Description |
|---|---|
| [tenancy-rbac/multi-tenancy.md](tenancy-rbac/multi-tenancy.md) | Tenancy hierarchy, isolation model, provisioning flow |
| [tenancy-rbac/roles.md](tenancy-rbac/roles.md) | Six roles, full permission matrix |
| [tenancy-rbac/rbac-resolver.md](tenancy-rbac/rbac-resolver.md) | 3-layer resolver, BASE_ROLE_GRANTS, usage pattern |

---

## Integration (CRM ↔ MIH)

| Document | Description |
|---|---|
| [integration/crm-integration-overview.md](integration/crm-integration-overview.md) | Two-webhook architecture, auth model, security checklist |
| [integration/mih-to-crm.md](integration/mih-to-crm.md) | MIH → CRM: request/response schema, retry schedule, rate limits |
| [integration/crm-to-mih.md](integration/crm-to-mih.md) | CRM → MIH: all 11 event kinds, idempotency, processing chain |
| [integration/auth.md](integration/auth.md) | Bearer token + HMAC-SHA256 implementation details |

---

## Connectors

| Document | Description |
|---|---|
| [connectors/connector-framework.md](connectors/connector-framework.md) | SourceConnector interface, registry, poller factory, health scoring, DLQ |
| [connectors/meta-lead-ads.md](connectors/meta-lead-ads.md) | Meta Lead Ads: OAuth, webhook, polling, field mapping, health scoring |
| [connectors/future-connectors.md](connectors/future-connectors.md) | JustDial, PropTiger, WhatsApp, email parser — future/blocked connectors |

---

## Phase Plans

### V0 — Foundation (~30 dev-days)
**Goal:** Scaffold, auth, multi-tenancy, ingestion pipeline, dedup, identity graph, CRM integration.

| Directive | Title | Effort | File |
|---|---|---|---|
| M-001 | Multi-tenancy + RBAC foundation | 3 days | [M-001](phases/v0-foundation/M-001-multitenancy.md) |
| M-002 | Supabase Auth + session management | 3 days | [M-002](phases/v0-foundation/M-002-auth.md) |
| M-003 | Connector framework + DLQ | 3 days | [M-003](phases/v0-foundation/M-003-connector-framework.md) |
| M-004 | Meta Lead Ads connector | 5 days | [M-004](phases/v0-foundation/M-004-meta-connector.md) |
| M-005 | Ingestion pipeline | 4 days | [M-005](phases/v0-foundation/M-005-ingestion-pipeline.md) |
| M-006 | Dedup engine | 4 days | [M-006](phases/v0-foundation/M-006-dedup-engine.md) |
| M-007 | Identity graph | 3 days | [M-007](phases/v0-foundation/M-007-identity-graph.md) |
| M-008 | Lead list + basic dashboard | 2 days | [M-008](phases/v0-foundation/M-008-lead-list.md) |
| M-009 | CRM integration | 4 days | [M-009](phases/v0-foundation/M-009-crm-integration.md) |
| M-010 | Source management UI | 2 days | [M-010](phases/v0-foundation/M-010-source-management.md) |
| M-011 | Org onboarding flow | 2 days | [M-011](phases/v0-foundation/M-011-onboarding.md) |
| M-012 | Admin CRM config | 1 day | [M-012](phases/v0-foundation/M-012-admin-crm-config.md) |

**V0 Acceptance Gate:** [V0 Overview](phases/v0-foundation/00-overview.md#v0-acceptance-gate)

---

### V1 — Marketing Operations (~47 dev-days)
**Pre-condition:** V0 acceptance gate passed.  
**Goal:** 6+ sources, spend tracking, attribution, ROI dashboards, billing.

| Directive | Title | Effort | File |
|---|---|---|---|
| M-101 | Google Ads connector | 5 days | [M-101](phases/v1-marketing-ops/M-101-google-ads.md) |
| M-102 | 99acres connector | 4 days | [M-102 to M-105](phases/v1-marketing-ops/M-102-to-M-105-connectors.md) |
| M-103 | MagicBricks connector | 4 days | [M-102 to M-105](phases/v1-marketing-ops/M-102-to-M-105-connectors.md) |
| M-104 | Housing.com connector | 4 days | [M-102 to M-105](phases/v1-marketing-ops/M-102-to-M-105-connectors.md) |
| M-105 | Manual lead entry | 1 day | [M-102 to M-105](phases/v1-marketing-ops/M-102-to-M-105-connectors.md) |
| M-106 | Dedup rule editor | 2 days | [M-106 to M-114](phases/v1-marketing-ops/M-106-to-M-114-features.md) |
| M-107 | Spend tracking | 4 days | [M-106 to M-114](phases/v1-marketing-ops/M-106-to-M-114-features.md) |
| M-108 | Attribution engine V1 (last-touch) | 5 days | [M-106 to M-114](phases/v1-marketing-ops/M-106-to-M-114-features.md) |
| M-109 | ROI dashboards | 5 days | [M-106 to M-114](phases/v1-marketing-ops/M-106-to-M-114-features.md) |
| M-110 | Lead detail panel | 3 days | [M-106 to M-114](phases/v1-marketing-ops/M-106-to-M-114-features.md) |
| M-111 | User management UI | 2 days | [M-106 to M-114](phases/v1-marketing-ops/M-106-to-M-114-features.md) |
| M-112 | Anomaly alerts V1 | 3 days | [M-106 to M-114](phases/v1-marketing-ops/M-106-to-M-114-features.md) |
| M-113 | DLQ management UI | 2 days | [M-106 to M-114](phases/v1-marketing-ops/M-106-to-M-114-features.md) |
| M-114 | Billing integration (Stripe) | 3 days | [M-106 to M-114](phases/v1-marketing-ops/M-106-to-M-114-features.md) |

**V1 Acceptance Gate:** [V1 Overview](phases/v1-marketing-ops/00-overview.md#v1-acceptance-gate)

---

### V2 — AI-Native (~36 dev-days)
**Pre-condition:** V1 in production ≥30 days with real data; ≥90 days clean attribution data.  
**Goal:** AI intent scoring, quality grading, diagnostic chat, creative kill recs, budget recs, multi-touch, cohort dashboards.

| Directive | Title | Effort | File |
|---|---|---|---|
| M-201 | AI intent scoring | 5 days | [M-201](phases/v2-ai-native/M-201-intent-scoring.md) |
| M-202 | AI quality grading | 3 days | [M-202](phases/v2-ai-native/M-202-quality-grading.md) |
| M-203 | AI diagnostic chat | 7 days | [M-203](phases/v2-ai-native/M-203-diagnostic-chat.md) |
| M-204 | AI creative kill recommendations | 5 days | [M-204](phases/v2-ai-native/M-204-creative-kill.md) |
| M-205 | AI budget allocation recommendations | 5 days | [M-205](phases/v2-ai-native/M-205-budget-allocation.md) |
| M-206 | Multi-touch attribution | 7 days | [M-206](phases/v2-ai-native/M-206-multi-touch.md) |
| M-207 | Cohort retention dashboards | 4 days | [M-207](phases/v2-ai-native/M-207-cohort-dashboards.md) |

**V2 Acceptance Gate:** [V2 Overview](phases/v2-ai-native/00-overview.md#v2-acceptance-gate)

---

## Decisions

| Document | Description |
|---|---|
| [decisions/locked.md](decisions/locked.md) | H.01–H.20: all locked architecture decisions |
| [decisions/anti-roadmap.md](decisions/anti-roadmap.md) | What we are NOT building and why |

---

## Key Numbers

| Metric | Value |
|---|---|
| Total directives | 33 (M-001 to M-207) |
| Total estimated effort | ~113 dev-days |
| V0 duration | ~6 weeks |
| V1 duration | ~9–10 weeks |
| V2 duration | ~7–8 weeks |
| Roles | 6 (super_admin, mih_org_admin, marketing_manager, marketing_analyst, marketing_ops, org_viewer) |
| Source connectors (V1) | 6+ (Meta, Google, 99acres, MagicBricks, Housing.com, Manual) |
| AI models (V2) | Haiku (scoring), Sonnet (diagnostics/recommendations) |
| Attribution models (V2) | 4 (last-touch, first-touch, linear, time-decay) |

---

## Implementation Rules (Reminders)

- `.env.local` is NEVER committed to git
- Credentials: AES-256-GCM encrypted at app layer; key in Supabase Vault
- `raw_leads`: NO UPDATE ever; append-only substrate
- All AI agents: T2 ceiling — advisory only; no autonomous mutations
- All inbound webhooks: HMAC-SHA256 + 5-minute timestamp window
- Every attribution model is a pure function (same inputs → same outputs)
- Nightly recomputes are idempotent (delete-then-insert, not upsert)
