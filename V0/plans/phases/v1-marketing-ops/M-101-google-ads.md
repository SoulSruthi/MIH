# M-101 · Google Ads Connector

**Depends on:** M-003  
**Effort:** 5 days

## Purpose
Google Ads lead form extensions + campaign data sync. Second major connector after Meta.

## In Scope
- Google OAuth (service account or user OAuth for Google Ads API)
- Google Ads Lead Form Asset API: poll for leads since last_sync
- Campaign/ad group/ad performance data sync (for attribution)
- Keyword-level attribution: `source_keyword` populated from search term reports
- Spend pull: `GET /customers/{customerId}/campaignBudgets` or reports API
- Field mapping: Google form fields → MIH raw lead schema

## Key Differences from Meta
- No webhook push — polling only
- Auth: OAuth 2.0 with offline access; refresh_token stored encrypted
- API versioning: Google Ads API v18+ (current at V0 time)
- Developer token required: `GOOGLE_ADS_DEVELOPER_TOKEN` env var

## Acceptance Criteria
```
[ ] Connect button → Google OAuth flow → stores refresh_token encrypted
[ ] Poll: fetches leads since last_sync_at, normalizes to RawLeadInput
[ ] source_keyword populated from Google keyword data
[ ] Spend pull: daily spend per campaign synced to spend_daily
[ ] Google API 429 → rate-limit backoff per Google's Retry-After header
[ ] Token refresh: automatic when access_token expires
```

## Module Location
```
modules/connectors/google-ads/
  index.ts, client.ts, oauth.ts, normalizer.ts, spend.ts
```
