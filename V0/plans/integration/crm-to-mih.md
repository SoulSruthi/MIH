# CRM → MIH: POST /api/crm/events

---

## Endpoint MIH Exposes

```
POST https://mih.builtrix.io/api/crm/events
Authorization: Bearer <crm_to_mih_token>
Content-Type: application/json
X-Builtrix-Signature: sha256=<hex>
X-Builtrix-Timestamp: 2026-05-14T08:30:00.000Z
```

---

## Event Envelope

```ts
{
  event_id: string          // UUID, stable for idempotency; CRM retries with same event_id
  organization_id: string
  event_kind: string        // see event kinds below
  source_product: 'ai_crm'
  ts: string                // ISO 8601 when CRM emitted
  payload: object           // event-kind-specific (see below)
}
```

---

## Event Kinds (all 11 must be handled in M-009)

### `lead.received`
```ts
payload: { lead_id: string; external_id: string; received_at: string }
```
MIH action: Confirm delivery; close ingestion loop.

### `lead.assigned`
```ts
payload: {
  lead_id: string; external_id: string;
  assigned_to_user_id: string; assigned_to_team_id: string;
  assigned_at: string; assignment_rule_id: string
}
```
MIH action: Track time-to-assignment (V1+ analytics).

### `lead.contacted`
```ts
payload: {
  lead_id: string; external_id: string;
  first_contact_at: string;
  contact_channel: 'call' | 'whatsapp' | 'email' | 'sms';
  contacted_by_user_id: string
}
```
MIH action: **Key conversion event** — contact rate per source. Update `unique_leads.last_lifecycle_state`.

### `lead.qualified`
```ts
payload: {
  lead_id: string; external_id: string; qualified_at: string;
  voice_iq_intent_score?: number;
  voice_iq_bant?: { budget: boolean; authority: boolean; need: boolean; timeline: boolean };
  qualified_by_user_id: string
}
```
MIH action: Qualification rate per source. Feeds attribution.

### `lead.lost`
```ts
payload: {
  lead_id: string; external_id: string; lost_at: string;
  loss_reason: string; loss_subcategory?: string
}
```
MIH action: Negative attribution — loss reason per source.

### `lead.junk`
```ts
payload: {
  lead_id: string; external_id: string; marked_junk_at: string;
  junk_reason: 'spam' | 'fake_number' | 'duplicate' | 'irrelevant' | 'other';
  marked_by_user_id: string
}
```
MIH action: **Source quality signal** — junk rate per source drives source-kill decisions.

### `lead.site_visit_scheduled`
```ts
payload: {
  lead_id: string; external_id: string; site_visit_id: string;
  project_id: string; project_name: string; scheduled_for: string
}
```
MIH action: Mid-funnel conversion metric.

### `lead.site_visit_completed`
```ts
payload: {
  lead_id: string; external_id: string; site_visit_id: string;
  outcome: 'attended' | 'no_show' | 'cancelled' | 'rescheduled';
  completed_at: string
}
```

### `deal.created`
```ts
payload: {
  lead_id: string; external_id: string; deal_id: string;
  estimated_value_inr: number; project_id: string; created_at: string
}
```
MIH action: Conversion → feeds CPL/CPA computation.

### `deal.won`
```ts
payload: {
  lead_id: string; external_id: string; deal_id: string;
  final_value_inr: number; project_id: string;
  unit_id?: string; won_at: string;
  total_days_from_lead_creation: number  // cohort analysis
}
```
MIH action: **The biggest one** — ROAS computation. `revenue_inr` populated in `attribution_rollups`.

### `deal.lost`
```ts
payload: {
  lead_id: string; external_id: string; deal_id: string;
  lost_at: string; loss_reason: string
}
```

---

## MIH Response

```ts
// 200 OK
{ ok: true; event_id: string; status: 'processed' | 'deduped' }

// 4xx — permanent failure; CRM should not retry
{ ok: false; error: string }

// 5xx — temporary; CRM will retry (with same event_id)
```

---

## Idempotency

MIH dedupes on `event_id` within `organization_id`. Duplicate `event_id` → returns `status='deduped'` with 200 (not an error).

---

## CRM Retry Policy (what CRM does on MIH 5xx)

Attempts: 0, 1 min, 5 min, 30 min, 2h, 12h (5 retries). After that, delivery logged as failed in CRM's `webhook_deliveries` and surfaced to CRM admin.

---

## Processing Chain (after successful receipt)

```
POST /api/crm/events
  → HMAC verification + timestamp window (reject if >5 min)
  → Bearer token validation
  → Insert crm_lifecycle_events (immutable, idempotency on event_id)
  → Update unique_leads.last_lifecycle_state + last_lifecycle_at
  → Fire Inngest: mih/crm.event_received
        → attribution/ updates rollups for affected dimensions
```

---

## MIH-Side Implementation Location

```
app/api/crm/events/route.ts      Route handler: HMAC + auth + idempotency
modules/crm-events/
  inbox.ts                       Event dispatch: routes to per-kind handler
  handlers/lead-contacted.ts     Per-event attribution logic
  handlers/deal-won.ts           ... etc for all 11 kinds
```
