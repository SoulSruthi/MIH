# Database Index Strategy

---

## Indexing Principles

1. Every FK gets an index (Postgres does not auto-index FKs)
2. Every multi-tenant query includes `organization_id` — always leftmost in composite indexes
3. No index on columns with <10 distinct values (e.g., boolean flags, small enums) unless combined with high-cardinality column
4. Partial indexes for `status IN ('active', 'pending')` patterns where inactive rows dominate
5. All indexes named: `idx_{table}_{columns}` for discoverability

---

## Core Table Indexes

### `organizations`
```sql
-- PK: id (btree, unique) — auto
-- No additional indexes needed; small table, accessed by PK only
```

### `raw_leads`
```sql
-- High-volume append-only table; query patterns drive indexes

CREATE INDEX idx_raw_leads_org_created
  ON raw_leads (organization_id, created_at DESC);
  -- Pattern: fetch recent leads per org

CREATE INDEX idx_raw_leads_org_source_created
  ON raw_leads (organization_id, source_id, created_at DESC);
  -- Pattern: per-source lead list

CREATE INDEX idx_raw_leads_phone_hash
  ON raw_leads (organization_id, phone_e164_hash)
  WHERE phone_e164_hash IS NOT NULL;
  -- Pattern: dedup phone lookup

CREATE INDEX idx_raw_leads_email_lower
  ON raw_leads (organization_id, lower(email))
  WHERE email IS NOT NULL;
  -- Pattern: dedup email lookup

CREATE INDEX idx_raw_leads_dedup_status
  ON raw_leads (organization_id, dedup_status, created_at DESC)
  WHERE dedup_status = 'pending';
  -- Partial: only pending; most rows are 'deduplicated'

CREATE INDEX idx_raw_leads_unique_lead
  ON raw_leads (unique_lead_id)
  WHERE unique_lead_id IS NOT NULL;
  -- Pattern: find all raw_leads for a unique_lead
```

### `unique_leads`
```sql
CREATE INDEX idx_unique_leads_org_created
  ON unique_leads (organization_id, created_at DESC);

CREATE INDEX idx_unique_leads_org_source
  ON unique_leads (organization_id, canonical_source_id, created_at DESC);

CREATE INDEX idx_unique_leads_crm_status
  ON unique_leads (organization_id, crm_handoff_status)
  WHERE crm_handoff_status IN ('pending', 'retrying');
  -- Partial: only actionable states

CREATE INDEX idx_unique_leads_intent_score
  ON unique_leads (organization_id, intent_score DESC)
  WHERE intent_score IS NOT NULL;
  -- Pattern: lead triage sorted by score
```

### `crm_lifecycle_events`
```sql
CREATE INDEX idx_crm_events_unique_lead
  ON crm_lifecycle_events (unique_lead_id, occurred_at DESC);
  -- Pattern: lead timeline

CREATE INDEX idx_crm_events_org_occurred
  ON crm_lifecycle_events (organization_id, occurred_at DESC);
  -- Pattern: org-wide event stream

CREATE INDEX idx_crm_events_type_occurred
  ON crm_lifecycle_events (organization_id, event_type, occurred_at DESC);
  -- Pattern: attribution engine — find all 'deal.won' events
```

### `attribution_rollups`
```sql
CREATE INDEX idx_attribution_rollups_period
  ON attribution_rollups (organization_id, period_start DESC, model_version);
  -- Pattern: ROI dashboard date range

CREATE INDEX idx_attribution_rollups_source
  ON attribution_rollups (organization_id, source_id, period_start DESC, model_version);
  -- Pattern: per-source drill-down

CREATE UNIQUE INDEX idx_attribution_rollups_unique
  ON attribution_rollups (organization_id, source_id, campaign_id, period_start, model_version)
  WHERE campaign_id IS NOT NULL;
-- + variant for NULL campaign_id:
CREATE UNIQUE INDEX idx_attribution_rollups_unique_no_campaign
  ON attribution_rollups (organization_id, source_id, period_start, model_version)
  WHERE campaign_id IS NULL;
```

### `spend_daily`
```sql
CREATE INDEX idx_spend_daily_org_date
  ON spend_daily (organization_id, spend_date DESC);

CREATE INDEX idx_spend_daily_source_date
  ON spend_daily (organization_id, source_id, spend_date DESC);

CREATE UNIQUE INDEX idx_spend_daily_unique
  ON spend_daily (organization_id, source_id, spend_date)
  WHERE superseded_by IS NULL;
  -- Only one active spend row per source per date
```

### `agent_actions`
```sql
CREATE INDEX idx_agent_actions_org_created
  ON agent_actions (organization_id, created_at DESC);

CREATE INDEX idx_agent_actions_entity
  ON agent_actions (entity_type, entity_id, created_at DESC);
```

### `audit_log`
```sql
CREATE INDEX idx_audit_log_org_created
  ON audit_log (organization_id, created_at DESC);

CREATE INDEX idx_audit_log_entity
  ON audit_log (entity_type, entity_id, created_at DESC);

CREATE INDEX idx_audit_log_actor
  ON audit_log (actor_id, created_at DESC);
```

---

## Query Performance Targets

| Query | Target | Index Used |
|---|---|---|
| Lead list (org, last 30 days) | <100ms | idx_raw_leads_org_created |
| Dedup phone lookup | <20ms | idx_raw_leads_phone_hash |
| ROI dashboard (90 days, 6 sources) | <500ms | idx_attribution_rollups_period |
| Lead timeline (single lead) | <50ms | idx_crm_events_unique_lead |
| Intent score triage list | <100ms | idx_unique_leads_intent_score |

---

## Index Maintenance

- `pg_stat_user_indexes` reviewed quarterly for unused indexes
- `VACUUM ANALYZE` runs automatically via Supabase maintenance window
- Bloat check: `pgstattuple` on any index that grows >10× its table size
