# Locked Decisions

These decisions are final for V0–V2. They may only be revisited with explicit product owner sign-off and a new ADR entry.

| ID | Decision | Rationale | Locked Since |
|---|---|---|---|
| H.01 | Multi-tenant, single Postgres schema with RLS | Simplicity + lower cost; separate schemas at >500 orgs | V0 |
| H.02 | `raw_leads` is append-only; no UPDATE | Immutable audit substrate; reprocessing rebuilds projections | V0 |
| H.03 | Last-touch attribution in V1 | Agreed with product owner; multi-touch deferred to V2 | V0 |
| H.04 | Inngest for all async work | No cron in Vercel routes; Inngest handles retries + DLQ natively | V0 |
| H.05 | AES-256-GCM for all credentials at app layer | DB sees only ciphertext; key in Supabase Vault | V0 |
| H.06 | CRM integration via HTTP webhooks only | No shared DB; clean SLA boundary between MIH and CRM | V0 |
| H.07 | HMAC-SHA256 + 5-min timestamp window on all inbound webhooks | Replay protection without OAuth complexity | V0 |
| H.08 | 6 fixed roles; no custom role creation | Custom roles → combinatorial explosion; 6 covers all use cases | V0 |
| H.09 | Vercel Mumbai region for compute | Latency to Indian users; data residency preference | V0 |
| H.10 | Supabase project `poooyfyonogxupnmxdcp` | Single project; separate schemas if multi-region needed later | V0 |
| H.11 | AI agents ≤ T2 (advisory only) | No autonomous mutations; humans approve all consequential actions | V0 |
| H.12 | Anthropic claude-haiku for scoring; Sonnet for diagnostics | Cost/quality tradeoff; haiku sufficient for classification tasks | V0 |
| H.13 | Per-org monthly AI token budget with hard cap | Prevent runaway costs from large orgs | V0 |
| H.14 | Identity graph: cluster-based, not row-based | A person is a cluster of identifiers; enables future cross-device merge | V0 |
| H.15 | `app_org_id()` DB function from JWT claim | RLS enforced at DB layer, not just app layer | V0 |
| H.16 | Upstash Redis for RBAC cache (5-min TTL) | Sub-millisecond permission checks without DB round-trip | V0 |
| H.17 | No auto-push to Meta/Google from budget recommendations (V2) | V3 scope; V2 is advisory only | V0 |
| H.18 | Linear model: split on distinct sources (not all raw_leads) | Avoids over-rewarding high-frequency sources | V0 |
| H.19 | Time-decay λ = 0.1 default; configurable per org | Reasonable half-life of ~7 days; allows org customization | V0 |
| H.20 | Cohort period: week-based primary, month-based secondary | Weekly granularity reveals nurture velocity patterns | V0 |

---

## How to Propose a Change

1. Open an issue tagged `[ADR]`
2. State: what changed, why the locked decision no longer applies, migration path
3. Requires sign-off from: product owner + tech lead
4. If approved → update this file + add entry to `decisions/changes.md`
