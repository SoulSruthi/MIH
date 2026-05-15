# Architecture Principles

Every PR is reviewed against these. Hook violations block merge. No exceptions without an ADR.

---

| # | Principle | Operational Meaning | Enforcement |
|---|---|---|---|
| **P1** | **Multi-tenancy is sacred** | Every row in every table has `organization_id`. RLS enforces at DB level. Super admin sees zero operational rows by construction. | RLS policy + nightly tenant-leak audit |
| **P2** | **Provenance on every record** | Every raw_lead carries `source_id`, `source_external_id`, `ingested_at`, `created_via`. Every AI-touched record carries `ai_confidence`. | Schema NOT NULL constraints |
| **P3** | **Append-only audit** | Every state-changing action writes an `audit_log` row. No deletes, no updates on audit rows. | Immutability trigger on `audit_log` |
| **P4** | **Touchpoints are immutable** | Once a `raw_lead` is written, it is never modified. Dedup decisions are projections on top. Reversible without losing source truth. | No UPDATE on raw_leads; app-layer enforcement |
| **P5** | **Identity is a graph** | A "person" is a cluster of identifiers (phone, email, ad-platform-id, crm-id), not a single row with one primary key. | `identity_identifiers` + `identity_clusters` schema |
| **P6** | **Attribution is a pure function** | Given touchpoints + model + conversion event → deterministic allocation. Replayable. Model-versioned. | `attribution/` module with no side effects; `model_version` column |
| **P7** | **AI agents are colleagues, not autopilots** | Tier ceilings apply (T0 read-only → T4 fully autonomous). All T2+ actions require human approval before side effects. | Agent tier ceiling in AI gateway (V2+) |
| **P8** | **Event-driven everywhere async work happens** | Inngest handles all async work. No ad-hoc cron in Vercel routes. No raw BullMQ. | Architecture review; Inngest-only async |
| **P9** | **Schemas evolve additively** | Optional fields can be added. Renaming/removing fields = new endpoint version. Breaking changes = `/v2/` prefix. | API versioning policy + migration-safe skill |
| **P10** | **Modular monolith over microservices** | One Next.js app, internal modules with ESLint-enforced boundaries. Microservices only when forced by compute or team topology. | ESLint no-restricted-imports rule |
| **P11** | **Stack discipline** | Next.js 16 + TypeScript + Supabase + Inngest + Anthropic + OpenAI fallback + Upstash KV + shadcn/ui. No exceptions without an ADR. | PRD §2 + V5 D-05 |
| **P12** | **Defense in depth** | App-layer filter AND RLS AND test suite. Never rely on a single layer. | Cross-tenant RLS tests required on every module |
| **P13** | **Reversibility on intelligence** | Every dedup merge, attribution assignment, AI grade is reversible. Decisions are rows, not in-place mutations. | Projection-rebuild capability on every projection table |
| **P14** | **Observability is P0, not P1** | A feature isn't done until traces, metrics, audit rows, and a runbook exist. | Definition of Done in V5 Gate 4 |
| **P15** | **Costs are accounted per-tenant** | Every AI call, external API call, and storage row maps to an `organization_id` for unit-economics visibility. | All AI + external calls tagged with org context |

---

## The Most Important Four

If you are in a time-crunch and can only deeply internalize four of these, make it:

1. **P1 — Multi-tenancy** — get this wrong and every subsequent feature inherits the breach
2. **P4 — Touchpoints immutable** — preserves the ability to replay, fix bugs, backfill attribution
3. **P5 — Identity is a graph** — enables V2 fuzzy matching without schema migration
4. **P6 — Attribution is pure** — deterministic, versionable, testable in isolation

---

## What Gets Blocked

The V5 PreToolUse hook blocks (deterministic, exit 2):

- Writes to `policy/**`, `baseline/**`, `.git/**`, `.env*` (except `.env.example`)
- `rm -rf` against repo root, `.git`, or `node_modules`
- `git push --force` outside `feature/*`
- Bash containing secret patterns (AWS, Stripe, OpenAI, GitHub, Google, private keys, DB URLs)

If a hook blocks legitimate work → it is a `runbooks/hook-false-positive.md` event. Never bypass.
