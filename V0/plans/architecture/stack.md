# Tech Stack — Locked Decisions

**Status:** Locked. Changes require an ADR.

---

## Primary Stack

| Layer | Technology | Rationale |
|---|---|---|
| Framework | Next.js 16 (App Router, RSC) | Same as AI CRM; shared component patterns possible |
| Language | TypeScript | Same as CRM; strict mode |
| Styling | Tailwind 4 + shadcn/ui | Same design system as CRM |
| Database | Supabase Postgres 15+ (RLS + Auth + Storage) | Same isolation model; Mumbai region for data residency |
| Auth | Supabase Auth (shared Auth project across MIH + CRM + Voice IQ) | One user, one credential, three apps; JWT custom claims |
| Async jobs | Inngest | Same cron + worker pattern as CRM; durable execution |
| AI — primary | Anthropic Claude | Same gateway pattern as CRM |
| AI — fallback | OpenAI GPT-4o | Embeddings + fallback when Anthropic unavailable |
| Rate limiting / KV | Upstash Redis | Sliding-window rate limit + RBAC 5-min cache + idempotency keys |
| Hosting | Vercel | Branch previews + 90s deploy cycle |
| Region | Mumbai (Supabase South Asia 1) | Data residency for Indian real estate data |

## Supporting Services

| Service | Purpose | Phase |
|---|---|---|
| Inngest | All async work: pollers, event chain, retries | V0 |
| Upstash KV | Rate limiting, RBAC cache, dedup idempotency | V0 |
| Supabase Storage | Archive `raw_payload` JSONB after 90 days | V1 |
| Supabase Realtime | Live dashboard push on new leads | V1 |
| Resend | Anomaly alert emails, invite emails | V1 |
| Stripe | Subscriptions + usage metering | V1 |
| Anthropic + OpenAI | AI gateway (intent scoring, diagnostic chat) | V2 |
| ClickHouse | Only if Postgres p95 dashboard load > 2s | V3+ trigger |

## Stack Discipline Rules

1. **No new dependency without an ADR** — one PR that adds a package must explain why the existing stack can't do it.
2. **No ClickHouse before Postgres becomes the bottleneck** — premature optimization is architectural debt.
3. **No microservices before team ≥ 3** — see architecture/overview.md §"Why one Vercel app".
4. **Inngest is the queue** — no raw BullMQ, no Vercel Cron as the sole mechanism for retry.
5. **shadcn components only** — no installing UI libraries that conflict. If shadcn doesn't have it, fork a shadcn component rather than bringing in a new library.

## Environment Variables (all in `.env.local`, never committed)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_PROJECT_REF

# Vercel (deployment + preview URL detection)
VERCEL_TOKEN
VERCEL_PROJECT_ID
VERCEL_TEAM_ID

# Upstash (rate limiting + cache)
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN

# Inngest
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY

# AI (V2+)
ANTHROPIC_API_KEY
OPENAI_API_KEY

# Connectors (per-org stored encrypted in DB; global keys only for OAuth apps)
META_APP_ID
META_APP_SECRET
GOOGLE_ADS_DEVELOPER_TOKEN

# Notifications (V1+)
RESEND_API_KEY
MSG91_API_KEY

# Billing (V1+)
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```
