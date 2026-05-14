# M-005 · Lead Ingestion Pipeline

**Depends on:** M-003 (M-004 for full integration testing)  
**Effort:** 2 days  
**V5 build prompt:**
```
Build feature: lead ingestion pipeline — raw_leads table, phone normalization to E.164,
email normalization, payload_hash dedup, Inngest mih/lead.ingested event chain
```

---

## Purpose

Single normalized landing point for every ingested lead, regardless of source.

---

## In Scope

### `ingest(input: RawLeadInput): Promise<RawLead>` function
1. Normalize `phone_e164` to E.164 (Indian default +91)
2. Normalize `email` (lowercase, trim)
3. Compute `payload_hash` (SHA-256 of canonical JSON: `{source_id, phone_e164, email, name, source_received_at}`)
4. Check `UNIQUE (source_id, source_external_id)` — skip if exists (idempotent)
5. Check `UNIQUE (organization_id, payload_hash)` — skip if hash already seen
6. Insert `raw_leads` row with `dedup_status='pending'`
7. Insert `audit_log` row: `action='raw_lead.ingested'`
8. Fire Inngest event `mih/lead.ingested` with `{ raw_lead_id, org_id, request_id }`

### Validation rules
- `phone_e164`: must be parseable to a valid E.164 number (use `libphonenumber-js`)
- `name`: non-empty string, min 2 chars after trim
- `source_received_at`: must be a valid ISO 8601 timestamp, not in the future by >1h

### Error handling
- Invalid phone → normalize failure → `connector_dlq` row, `failure_stage='normalize'`
- DB insert failure (non-constraint) → retry once, then DLQ
- Constraint violation on `payload_hash` → idempotent skip (return existing row)

---

## Acceptance Criteria

```
[ ] 1000 concurrent ingestions of unique leads → 1000 raw_lead rows
[ ] Same (source_id, source_external_id) submitted twice → 1 raw_lead row, second is idempotent skip
[ ] Same payload hash from two different sources → 1 raw_lead row for each unique source_external_id
[ ] Invalid phone number → DLQ row, no raw_lead insert
[ ] mih/lead.ingested Inngest event fires after every successful insert
[ ] audit_log row written per insert
[ ] Phone '9876543210' normalized to '+919876543210' before hash + storage
```

---

## Module Location

```
modules/ingestion/
  index.ts        exports: ingest()
  normalize.ts    phone + email normalization
  hash.ts         canonical payload hash computation
  validate.ts     Zod schema for RawLeadInput
```

---

## Inngest Events Produced

| Event | When |
|---|---|
| `mih/lead.ingested` | After every successful raw_lead insert |

---

## Migration File

`supabase/migrations/005_raw_leads.sql` (raw_leads table + indexes + RLS + immutability comment)
