# Future & V1 Connector Specs

---

## JustDial Connector (V1 candidate, pending API access)

**Status:** Blocked on JustDial API partnership  
**Directive:** M-115 (if API access granted before V1 gate)

### Auth Model
- JustDial provides API key per registered business account
- Leads delivered via push webhook OR email-based polling (same as 99acres)

### Ingestion Method
- Primary: JustDial pushes leads to `POST /api/inbound/justdial`
- Fallback: Email parsing (JustDial sends lead notification emails)

### Key Fields
```
source_channel = 'aggregator'
source_campaign_id = JustDial listing ID
source_ad_id = JustDial ad category ID
```

### Field Mapping (JustDial payload)
| JustDial Field | MIH Field |
|---|---|
| `MOBILE` | `phone_raw` |
| `NAME` | `name` |
| `EMAIL` | `email` |
| `CATEGORY` | `custom_fields.jd_category` |
| `CITY` | `custom_fields.city` |
| `AREA` | `custom_fields.area` |
| `DATE` | `source_submitted_at` |
| `LEADID` | `source_lead_id` |

### Acceptance Criteria (when API available)
```
[ ] Webhook endpoint verifies JustDial-specific auth header
[ ] source_channel = 'aggregator' on all JustDial leads
[ ] LEADID stored as source_lead_id; duplicate prevention active
[ ] Email fallback: JustDial email template parsed correctly
```

---

## PropTiger / Housing.com Group Connector (V1 M-104 extension)

**Status:** M-104 covers Housing.com. PropTiger is same group (REA Group India).  
**Note:** If PropTiger uses same API endpoint as Housing.com → same connector, different `source_channel` value.

### Differences from Housing.com
- PropTiger uses different webhook auth header (`X-PT-Signature`)
- PropTiger lead payload has `property_id` instead of `listing_id`
- PropTiger sends leads for luxury segment only (>₹1Cr properties)

### Additional Field
```
source_channel = 'aggregator'
custom_fields.property_tier = 'luxury'   (for PropTiger leads)
```

---

## Google Display / YouTube Connector (V1 extension of M-101)

**Status:** M-101 covers Google Search (lead form extensions). Display/YouTube leads come through Google Ads Lead Form Assets — same API endpoint.

### Additional Fields
| Campaign Type | Field |
|---|---|
| Display | `source_ad_format = 'display'` |
| YouTube | `source_ad_format = 'video'` |
| Search | `source_ad_format = 'search'` (existing) |

No new module needed — add `source_ad_format` to M-101 normalizer.

---

## Email Lead Parsing — Generic Connector

**Status:** V1 utility used by 99acres (M-102) and JustDial  
**Directive:** Sub-module of M-102; not a standalone directive

### Purpose
Parse structured lead data from email notifications sent by portals that don't have webhook/API access.

### Architecture
```
Email Inbox (dedicated: leads-inbound@{org}.mih.app)
  → Gmail API polling OR Postmark inbound
  → modules/connectors/email-parser/
      template-matcher.ts   — identifies portal by sender + subject pattern
      field-extractor.ts    — regex-based field extraction per template
      normalizer.ts         — extracted fields → RawLeadInput
```

### Templates Supported (V1)
- 99acres lead notification email
- JustDial lead alert email
- MagicBricks email (fallback when webhook fails)

### Template Registry
```typescript
interface EmailTemplate {
  portal:           string;
  sender_pattern:   RegExp;
  subject_pattern:  RegExp;
  field_extractors: Record<string, RegExp>;
}
```

---

## Walk-in / Channel Partner (M-105 — in scope V1)

Covered in V1 M-105 plan. Key points:
- Not an external connector — internal form
- `source_kind = 'walk_in' | 'channel_partner'`
- Excluded from CPL calculations (no associated spend)
- Goes through same `ingest()` pipeline

---

## WhatsApp Business Connector (Deferred — see anti-roadmap)

- Requires Meta Business Solution Provider (BSP) registration
- WhatsApp Cloud API + webhook for message events
- Template message-based lead capture
- **Deferred:** BSP registration takes 4–8 weeks; not on V1 critical path
- Will be M-116 if BSP approval comes through

---

## Connector Effort Estimates (V1 remaining)

| Connector | Status | Effort | Directive |
|---|---|---|---|
| 99acres | In scope V1 | 4 days | M-102 |
| MagicBricks | In scope V1 | 4 days | M-103 |
| Housing.com | In scope V1 | 4 days | M-104 |
| JustDial | Blocked on API | 3 days | M-115 (conditional) |
| PropTiger | Blocked on API | 2 days | M-116 (conditional) |
| WhatsApp | Deferred | — | Anti-roadmap |
| Offline/CSV | In scope V1 (M-105) | 1 day | M-105 |
