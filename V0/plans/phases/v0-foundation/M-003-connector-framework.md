# M-003 · Connector Framework

**Depends on:** M-001, M-002  
**Effort:** 3 days  
**V5 build prompt:**
```
Build feature: connector framework SDK — SourceConnector interface, Inngest poller scaffold,
connector_dlq table, health-score update logic, exponential retry, circuit breaker pattern
```

---

## Purpose

Plugin-style architecture so adding a new source (Sulekha, PropTiger, etc.) is a single-file drop, not a sprint.

---

## In Scope

- `SourceConnector` interface (see `plans/connectors/connector-framework.md`)
- Connector registry: `registerConnector` + `getConnector` + `listConnectors`
- `createPoller(kind)` factory: Inngest cron function, concurrency-limited, per-source isolation
- `connector_dlq` table migration (see schema-v0.sql)
- `sources` table migration + RLS
- Health score update logic (increment on success, decrement on failure — see connector framework plan)
- Circuit breaker: open after 5 consecutive 5xx in 1-min window (per source)
- E.164 phone normalization utility (Indian default: prepend +91 if 10-digit)
- Webhook HMAC verification utility (shared across Meta, CRM, future sources)

---

## Acceptance Criteria

```
[ ] Adding a new connector requires zero changes outside modules/connectors/<kind>/
[ ] Poller handles vendor 5xx: retries with exponential backoff, decrements health_score
[ ] Poller handles vendor 401/403: sets source.state='degraded', alerts org admin
[ ] Poller failure in org A does not affect org B's sources
[ ] Circuit breaker opens after 5 consecutive failures in 1 min; stops polling that source
[ ] DLQ row written for every failed normalization or ingestion
[ ] E.164 normalization: +919876543210 and 9876543210 and 09876543210 all resolve to +919876543210
[ ] Health score reaches 100 after 10 consecutive successful syncs from 0
```

---

## Module Location

```
modules/connectors/
  _kernel/
    types.ts
    registry.ts
    poller.ts
    health.ts
    circuit-breaker.ts
    hmac.ts
    normalizer.ts        E.164 normalization
```

---

## Migration File

`supabase/migrations/003_connector_framework.sql` (sources table, connector_dlq table, RLS)
