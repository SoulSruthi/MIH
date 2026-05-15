# M-004 · Meta Lead Ads Connector

**Depends on:** M-003  
**Effort:** 5 days  
**V5 build prompt:**
```
Build feature: Meta Lead Ads connector — OAuth flow (Meta Business Login),
POST /api/inbound/meta webhook with HMAC verification, lead normalization to E.164,
idempotency on source_external_id, Meta Graph API polling fallback
```

---

## Purpose

First production source. Proves the M-003 connector framework end-to-end.

---

## In Scope

### OAuth flow
- `/api/oauth/meta/start` — redirect to Meta Business Login
- `/api/oauth/meta/callback` — exchange code for access token, encrypt + store in `credentials`
- `config.page_id` — which Meta Page's leads to ingest
- `config.form_ids` — optional allowlist of form IDs (empty = all forms for the page)

### Webhook endpoint
- `POST /api/inbound/meta` — receives Meta leadgen webhook
- Verify Meta webhook signature (SHA-256 HMAC with app secret)
- Idempotency: skip if `source_external_id` already exists
- Map Meta form field answers → MIH raw lead schema

### Polling fallback
- `source.meta_lead_ads.poll` Inngest cron (every 5 min)
- Calls `GET /v18.0/{page_id}/leadgen_forms` + `GET /v18.0/{form_id}/leads?since=<last_sync>`
- Catches leads that missed the webhook (Meta's at-least-once guarantee has gaps)

### Spend pull
- `spend.meta_lead_ads.daily_sync` Inngest cron (daily 02:00 IST)
- Calls `GET /v18.0/act_{ad_account_id}/insights` for daily spend per campaign

### Field mapping (Meta form fields → MIH)
```
full_name         → name
phone_number      → phone_e164 (normalize to E.164)
email             → email
city              → preference_location
budget?           → preference_budget_band (mapping table)
bhk?              → preference_bhk
```

---

## Acceptance Criteria

```
[ ] Meta OAuth flow: org admin can connect a Meta page from /admin/sources
[ ] Webhook: POST /api/inbound/meta with valid HMAC → inserts raw_lead
[ ] Webhook: invalid HMAC → 401, no insert
[ ] Webhook: duplicate leadgen_id → idempotent (no duplicate insert, returns 200)
[ ] Polling: catches leads since last_sync_at
[ ] Phone normalization: '9876543210' → '+919876543210'
[ ] Source state transitions: unauthorized → authorized (after OAuth) → active (first poll)
[ ] Meta API 429 → exponential backoff, health_score -= 5
[ ] Meta token expired → source.state='degraded', alert org admin
```

---

## Module Location

```
modules/connectors/meta-lead-ads/
  index.ts         registers connector + exports webhook handler
  client.ts        Meta Graph API client (typed)
  webhook.ts       POST /api/inbound/meta handler
  oauth.ts         Business Login OAuth flow
  normalizer.ts    Meta form fields → RawLeadInput
  spend.ts         Meta Insights API → SpendRecord[]
```

---

## Migration File

`supabase/migrations/004_meta_connector_config.sql` (source config schema additions)

---

## Env Vars Required

```
META_APP_ID
META_APP_SECRET        # for webhook HMAC verification
META_WEBHOOK_VERIFY_TOKEN  # for webhook subscription verification
```
