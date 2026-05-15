# M-102 to M-105 · Additional Source Connectors

---

## M-102 · 99acres Connector
**Depends on:** M-003 | **Effort:** 4 days

### Auth model
API key-based. 99acres provides a portal API key per registered broker/builder account.

### Ingestion method
- Email parsing (99acres sends lead emails to a configured inbox) — primary V1 method
- Portal API polling (when 99acres provides API access) — secondary
- Field mapping: 99acres email template → MIH raw lead schema

### Key fields
- `source_campaign_id` = 99acres package ID (if available)
- `source_ad_id` = listing ID
- `source_channel` = 'aggregator'

### Acceptance Criteria
```
[ ] API key stored encrypted in credentials
[ ] Leads ingested within polling interval (5 min for API; email near-realtime)
[ ] 99acres-specific fields mapped correctly to RawLeadInput
[ ] source_channel = 'aggregator' on all 99acres leads
```

---

## M-103 · MagicBricks Connector
**Depends on:** M-003 | **Effort:** 4 days

Same pattern as 99acres. MagicBricks has its own portal API and email lead delivery.

### Key differences from 99acres
- MagicBricks API uses different auth headers
- Lead payload schema differs (different field names for name/phone/property type)
- MagicBricks sends leads via POST webhook to a registered URL (push model)

### In Scope
- Webhook endpoint: `POST /api/inbound/magicbricks` + HMAC verify
- API polling fallback
- Field mapping: MagicBricks payload → RawLeadInput

---

## M-104 · Housing.com Connector
**Depends on:** M-003 | **Effort:** 4 days

Same pattern. Housing.com (PropTiger group) uses a webhook-based delivery model.

### In Scope
- Webhook endpoint: `POST /api/inbound/housing`
- Auth: shared secret per registered endpoint
- Field mapping: Housing.com lead schema → RawLeadInput
- `source_channel` = 'aggregator'

---

## M-105 · Manual Lead Entry
**Depends on:** M-005 | **Effort:** 1 day

### Purpose
Walk-in leads + channel partner referrals that have no digital source.

### In Scope
- `/sources/manual-entry` page (marketing_ops permission)
- Single-lead form: name, phone, email, source_kind (walk_in / channel_partner / broker), notes
- CSV upload: bulk import, column mapping UI, validation summary
- Both paths go through `modules/ingestion/ingest()` like any other source
- `source_kind` = 'walk_in' or 'channel_partner'
- `source_channel` = 'walk_in' or 'cp'

### Acceptance Criteria
```
[ ] Manual form: valid lead → raw_lead inserted → dedup → CRM handoff
[ ] CSV upload: up to 1000 rows, validates all rows before inserting any
[ ] CSV upload: validation errors shown per-row with column reference
[ ] Walk-in leads correctly excluded from CPL calculations (no spend for walk-ins)
```
