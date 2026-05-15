# Meta Lead Ads Connector

**Directive:** M-004  
**Effort:** 5 days

## Purpose

Primary paid lead source for Indian real estate developers. Meta Lead Ads allow users to submit forms without leaving Facebook/Instagram. MIH ingests these via webhook (real-time) with polling fallback.

---

## Auth Model

- **App-level:** Meta App with `leads_retrieval` permission
- **User-level:** OAuth with `ads_management` + `pages_read_engagement` scopes
- **Long-lived token:** exchanged for 60-day token; stored AES-256-GCM encrypted
- **Token refresh:** auto-refresh at 55 days; failure → org admin alert + source health_score drops to 0

## Ingestion Flow

### Primary: Webhook (real-time)

```
Meta → POST /api/inbound/meta
     ← 200 OK (within 5 seconds; Meta retries if timeout)

Webhook handler:
  1. Verify X-Hub-Signature-256 (HMAC-SHA256 with APP_SECRET)
  2. Parse leadgen notification: { leadgen_id, page_id, form_id, ad_id }
  3. Enqueue Inngest event: mih/meta.leadgen_received { leadgen_id, org_id }

Inngest handler:
  4. Fetch full lead: GET /v18.0/{leadgen_id}?access_token={page_access_token}
  5. Map fields → RawLeadInput
  6. Call ingestion pipeline
```

### Fallback: Polling (Inngest cron every 5 min)

```
Inngest cron: mih/meta.poll (every 5 minutes)
  1. For each active Meta source:
     GET /v18.0/{form_id}/leads?since={last_sync_at}&access_token={token}
  2. Deduplicate against leadgen_ids already in raw_leads.source_lead_id
  3. Ingest new leads only
  4. Update source_connections.last_sync_at
```

---

## Field Mapping

| Meta Field | MIH Field | Notes |
|---|---|---|
| `field_data[name]` | `name` | Concatenate first_name + last_name if split |
| `field_data[phone_number]` | `phone_raw` | Normalized to E.164 by normalizer |
| `field_data[email]` | `email` | Lowercased |
| `ad_id` | `source_ad_id` | |
| `campaign_id` | `source_campaign_id` | |
| `adset_id` | `source_adset_id` | |
| `form_id` | `source_form_id` | |
| `created_time` | `source_submitted_at` | ISO 8601 → timestamptz |
| `id` (leadgen_id) | `source_lead_id` | Unique constraint prevents re-ingestion |
| — | `source_channel` | `'paid_social'` (hardcoded) |

Custom form questions mapped to `custom_fields JSONB`.

---

## HMAC Verification

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

export function verifyMetaSignature(
  rawBody: Buffer,
  signatureHeader: string,   // "sha256=abc123..."
  appSecret: string
): boolean {
  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  if (expected.length !== signatureHeader.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}
```

## Rate Limiting

- Meta Graph API: 200 calls/hour per token (app-level budget)
- Polling uses one call per form per 5-min window
- On 429: backoff per `x-business-use-case-usage` header; exponential up to 60s
- Rate limit state stored in Upstash Redis: `meta:rate:{org_id}:remaining`

---

## Health Scoring

| Signal | Score Impact |
|---|---|
| Last successful poll < 10 min ago | +40 |
| Last successful webhook < 1 hour | +40 |
| Token valid (not expired) | +20 |
| 429 rate limit in last hour | -30 |
| Token expires in <5 days | -20 |
| No leads in 48h (for active campaigns) | -10 |

## Module Location

```
modules/connectors/meta-lead-ads/
  index.ts          — registers as SourceConnector
  client.ts         — Graph API calls (fetchLead, listLeads, getAdInfo)
  oauth.ts          — OAuth flow + token exchange + refresh
  normalizer.ts     — Meta payload → RawLeadInput
  webhook.ts        — HMAC verification + webhook parsing
  spend.ts          — pull daily spend from Meta Ads Insights API
  health.ts         — health score computation
  __tests__/
    normalizer.test.ts
    webhook.test.ts
    spend.test.ts

app/api/inbound/meta/route.ts   — webhook endpoint
```

## Env Vars

```
META_APP_ID
META_APP_SECRET
META_VERIFY_TOKEN    (webhook verification handshake)
```

Per-org credentials stored in `credentials` table (encrypted):
```
meta_page_access_token
meta_ad_account_id
```

## Acceptance Criteria

```
[ ] Webhook: lead submitted on Meta → ingested in MIH within 30 seconds
[ ] HMAC verification: invalid signature → 401, not processed
[ ] Polling fallback: if webhook not configured, leads appear within 5 minutes
[ ] source_lead_id unique: re-delivery of same leadgen_id → not double-ingested
[ ] Token refresh: auto-refresh at day 55; alert if refresh fails
[ ] Spend pull: daily spend per campaign synced to spend_daily by 06:00 IST
[ ] Rate limit: 429 → exponential backoff; no crash
[ ] Health score: drops to <50 when token expires within 5 days
[ ] Field mapping: phone_number → E.164 format; invalid phone → raw_lead.dedup_status='invalid'
```
