# M-009 · CRM Event Inbox

**Depends on:** M-001, M-002 (can be built in parallel with M-007/M-008)  
**Effort:** 2 days  
**V5 build prompt:**
```
Build feature: CRM event inbox — POST /api/crm/events, HMAC + timestamp verification,
crm_lifecycle_events immutable table, idempotency on event_id, all 11 event kinds handled,
Inngest mih/crm.event_received, update unique_leads.last_lifecycle_state
```

---

## Purpose

Receive CRM lifecycle events (lead.contacted, deal.won, etc.) to power attribution and close the ROI loop.

---

## In Scope

### Endpoint: `POST /api/crm/events`

1. Read `Authorization: Bearer <token>` → validate against org's stored token hash
2. Read `X-Builtrix-Signature` + `X-Builtrix-Timestamp` → HMAC verify
3. Parse body → validate `event_id` + `organization_id` + `event_kind`
4. Check `UNIQUE (organization_id, event_id)` — if exists → return `{ ok: true, status: 'deduped' }`
5. Insert `crm_lifecycle_events` (immutable)
6. Look up `unique_lead` via `external_id` from payload → set `mih_unique_lead_id`
7. Update `unique_leads.last_lifecycle_state` + `last_lifecycle_at`
8. Fire Inngest `mih/crm.event_received` with `{ event_id, event_kind, unique_lead_id, org_id }`

### All 11 event kinds handled
`lead.received`, `lead.assigned`, `lead.contacted`, `lead.qualified`, `lead.lost`,
`lead.junk`, `lead.site_visit_scheduled`, `lead.site_visit_completed`,
`deal.created`, `deal.won`, `deal.lost`

See full payload specs: `plans/integration/crm-to-mih.md`

### Response
```ts
// 200
{ ok: true; event_id: string; status: 'processed' | 'deduped' }
// 4xx — don't retry
{ ok: false; error: string }
// 5xx — CRM will retry
```

---

## Acceptance Criteria

```
[ ] Valid HMAC + bearer → processes event, returns { ok: true, status: 'processed' }
[ ] Invalid HMAC → 401, no insert
[ ] Timestamp > 5 min old → 401, no insert
[ ] Duplicate event_id → returns { ok: true, status: 'deduped' }, no duplicate insert
[ ] All 11 event kinds: valid body → crm_lifecycle_events row inserted
[ ] lead.contacted → unique_leads.last_lifecycle_state='contacted'
[ ] deal.won → unique_leads.last_lifecycle_state='won'
[ ] external_id not found → crm_lifecycle_events still inserted, mih_unique_lead_id=null
[ ] mih/crm.event_received Inngest event fires after every successful insert
[ ] audit_log row per received event
```

---

## Module Location

```
app/api/crm/events/route.ts    Route handler (HMAC + auth + idempotency)
modules/crm-events/
  index.ts                     exports: processEvent
  inbox.ts                     parse + validate + dedup event
  handlers/
    lead-received.ts
    lead-contacted.ts
    lead-qualified.ts
    lead-lost.ts
    lead-junk.ts
    site-visit.ts
    deal-created.ts
    deal-won.ts
    deal-lost.ts
```

---

## Migration File

`supabase/migrations/009_crm_lifecycle_events.sql`
