# MIH → CRM: POST /api/sister/v1/leads

---

## Endpoint

```
POST https://crm.builtrix.io/api/sister/v1/leads
Authorization: Bearer <mih_crm_token>
Content-Type: application/json
X-Builtrix-Signature: sha256=<hex>
X-Builtrix-Timestamp: 2026-05-14T08:30:00.000Z
X-Builtrix-Idempotency-Key: <mih_unique_lead.crm_external_id>
```

---

## Request Body Schema

```ts
{
  // Identity + tenancy (required)
  organization_id: string           // UUID of the CRM org
  external_id: string               // MIH's stable id (used for dedup + idempotency)

  // Contact (required)
  name: string                      // min 2 chars
  phone_e164: string                // E.164, e.g. +919876543210
  email?: string                    // RFC 5322

  // Source provenance (required — critical for attribution)
  source: string                    // 'meta_lead_ads' | '99acres' | 'walk_in' | ...
  source_channel: 'paid_social' | 'paid_search' | 'aggregator' |
                  'organic_web' | 'walk_in' | 'cp' | 'broker'
  source_received_at: string        // ISO 8601 when source platform received the lead

  // Source detail (optional but strongly recommended)
  source_campaign_id?: string
  source_campaign_name?: string
  source_ad_id?: string
  source_ad_name?: string
  source_creative_id?: string
  source_keyword?: string           // for search ads
  source_referrer_url?: string

  // Real-estate preference (optional)
  preference?: {
    bhk?: number                    // 1–5
    budget_band?: string            // '50L-1Cr' | '1-1.5Cr' | '1.5-2Cr' | '2-5Cr' | '>5Cr'
    project_interest?: string
    area_sqft_min?: number
    area_sqft_max?: number
    city?: string
    locality?: string
    possession_timeline?: 'ready_to_move' | '3_months' | '6_months' | '12_months' | 'investment'
  }

  // Demographics (optional)
  age?: number
  gender?: 'male' | 'female' | 'other' | 'prefer_not_say'
  occupation?: string
  notes?: string

  // MIH enrichment (optional, populated in V2+)
  mih_intent_score?: number         // 0–100
  mih_quality_grade?: 'A' | 'B' | 'C' | 'D'
  mih_dedup_merged_from?: string[]  // external_ids merged into this lead

  // Audit (required)
  raw_payload: object               // original source payload, archived for audit
}
```

---

## Response Schemas

```ts
// 201 Created — new lead
{
  lead_id: string               // CRM's UUID
  status: 'created'
  allocated_to_user_id: string | null
  crm_lead_url: string          // https://crm.builtrix.io/dashboard/leads/<uuid>
}

// 200 OK — duplicate (CRM already has this external_id)
{
  lead_id: string               // original CRM lead UUID
  status: 'duplicate_merged'
  merged_with_external_id: string
  crm_lead_url: string
}

// 400 — schema invalid
{
  error: 'schema_invalid'
  details: { field: string; issue: string }[]
}

// 401 — bearer token invalid
{ error: 'unauthorized' }

// 403 — token org_id mismatch
{ error: 'forbidden' }

// 429 — rate limited
{ error: 'rate_limited' }
// + header: Retry-After: <seconds>

// 5xx — CRM-side error; safe to retry
{ error: 'internal' | 'service_unavailable' }
```

---

## Rate Limits (CRM-enforced)

- Per-org: 100 leads/sec (sliding window)
- Per-token: 1000 leads/min
- Daily cap: none (subscription tier enforces elsewhere)

---

## Idempotency

CRM dedupes on `external_id` within an org. If MIH retries the same payload (network error, etc.), CRM returns the original lead_id with `status='created'`. Also dedupes on `phone_e164` as secondary check.

---

## MIH Retry Policy (M-008)

| Attempt | Delay |
|---|---|
| 1 | immediate |
| 2 | 1s |
| 3 | 5s |
| 4 | 30s |
| 5 | 5 min |
| 6 | 30 min |
| 7 | 2h |
| 8 (final) | 12h |

After 8 failures: mark `crm_handoff_status='failed'`, write to `connector_dlq`, alert ops.

Always use the same `external_id` on retries (idempotency).

---

## When CRM Is Down (H.10 locked)

1. MIH queues `unique_lead` in `crm_handoff_status='pending'`
2. Inngest cron sweep runs every 5 min; picks up pending leads and retries
3. SLA: 99.5%+ delivery within 24h of lead ingestion
4. After 24h with no delivery: DLQ + ops alert

---

## MIH-Side Implementation Location

```
modules/crm-handoff/
  worker.ts          Inngest function: mih/lead.dedup_decided handler
  client.ts          HTTP client for CRM POST with HMAC signing
  retry.ts           Retry schedule + backoff calculator
  circuit-breaker.ts Circuit breaker pattern (open after 5 consecutive 5xx in 1 min)
  dns-guard.ts       SSRF protection: validates CRM base URL before first call
```
