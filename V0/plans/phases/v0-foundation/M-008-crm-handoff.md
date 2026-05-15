# M-008 · CRM Handoff Worker

**Depends on:** M-007  
**Effort:** 3 days  
**V5 build prompt:**
```
Build feature: CRM handoff worker — POST /api/sister/v1/leads to CRM,
outbound_deliveries tracking, 8-attempt exponential retry with Inngest,
circuit breaker, DLQ on final failure, unique_leads.crm_handoff_status update,
HMAC signing on outbound requests
```

---

## Purpose

Reliable delivery of unique leads to the AI CRM. 99.5%+ delivery within 24h SLA.

---

## In Scope

### Inngest function: `mih/lead.dedup_decided` handler (when `dedup_status='unique'`)

1. Load `unique_lead` + org's CRM credentials
2. Decrypt CRM bearer token + HMAC secret from `credentials` table
3. Build CRM request body (see `plans/integration/mih-to-crm.md`)
4. HMAC-sign the request
5. POST to `<crm_base_url>/api/sister/v1/leads`
6. On **2xx**: update `unique_leads.crm_handoff_status='succeeded'`, `crm_lead_id`, `crm_handoff_at`
7. On **4xx** (400, 401, 403): mark `failed`, alert ops via email, no retry
8. On **5xx or timeout**: queue Inngest retry (see retry schedule)

### `outbound_deliveries` row per attempt
```ts
{
  organization_id,
  unique_lead_id,
  target: 'crm',
  endpoint_url: crm_base_url + '/api/sister/v1/leads',
  idempotency_key: unique_lead.crm_external_id,
  attempt_number,
  status,
  http_status,
  response_body: truncated to 500 chars,
  error_message,
  attempted_at,
  next_retry_at,
}
```

### Retry schedule (Inngest sleep between attempts)
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

After 8 failures: `crm_handoff_status='failed'`, write `connector_dlq`, email ops.

### Circuit breaker
- Opens when: 5 consecutive 5xx within 1 min from same CRM base_url
- When open: mark all pending leads for that org as `queued` (do not attempt)
- Re-close after: 5-min cooldown + health-check ping
- `audit_log`: `action='crm_circuit_breaker.opened'` + `'closed'`

### SSRF guard
- Before first call to a configured `crm_base_url`, resolve DNS + reject private IP ranges (10.x, 172.16.x, 192.168.x, 127.x)

---

## Acceptance Criteria

```
[ ] Unique lead → CRM POST fires within 60 sec of dedup decision
[ ] CRM 5xx → automatic retry on Inngest schedule
[ ] CRM 4xx → immediate fail; no retry; ops alert
[ ] 3 simultaneous attempts with same external_id → CRM receives exactly 1 (idempotency)
[ ] After 8 failures → crm_handoff_status='failed' + connector_dlq row
[ ] outbound_deliveries row per attempt with correct http_status
[ ] Circuit breaker opens after 5 consecutive 5xx; queues leads; closes after cooldown
[ ] Private IP in crm_base_url → rejected with audit log
[ ] CRM response 201 → crm_lead_id populated on unique_leads
```

---

## Module Location

```
modules/crm-handoff/
  index.ts          exports: triggerHandoff, retryPendingLeads
  worker.ts         Inngest function handler
  client.ts         HTTP client with HMAC signing + retry logic
  circuit-breaker.ts
  dns-guard.ts
  builder.ts        builds CRM request body from unique_lead + raw_leads
```

---

## Migration File

`supabase/migrations/008_outbound_deliveries.sql`
