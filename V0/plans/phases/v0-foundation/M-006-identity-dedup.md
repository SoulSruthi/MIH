# M-006 · Identity Graph + Dedup Engine

**Depends on:** M-005  
**Effort:** 3 days  
**V5 build prompt:**
```
Build feature: identity graph and dedup engine — identity_clusters table,
identity_identifiers table, V0 phone-based dedup with configurable window per org,
Inngest mih/lead.dedup_decided event, cross-source dedup test suite
```

---

## Purpose

Deduplicate leads across sources. The primary match key is phone_e164. A person is a cluster of identifiers, not a single row.

---

## In Scope

### Tables (from schema-v0.sql)
- `identity_identifiers`
- `identity_clusters`

### Inngest function: `mih/lead.ingested` handler

Dedup algorithm (V0 phone-based):

```
1. Normalize phone_e164 from raw_lead
2. Lookup identity_identifiers WHERE:
   - organization_id = org
   - identifier_type = 'phone_e164'
   - identifier_value = phone_e164
3. If FOUND:
   a. Get cluster_id from identifier
   b. Get unique_lead via identity_cluster.primary_unique_lead_id
   c. Check dedup_rules.phone_window_hours:
      - If (now - unique_lead.last_seen_at) <= window → DUPLICATE
      - If > window AND post_window_behavior='new_lead' → UNIQUE (new person)
      - If > window AND post_window_behavior='merge_existing' → MERGE into existing
4. If NOT FOUND:
   a. Create new identity_cluster
   b. Create identity_identifier (phone_e164)
   c. Mark raw_lead → UNIQUE
5. Update raw_lead.dedup_status
6. Fire Inngest: mih/lead.dedup_decided
```

### On DUPLICATE
- `raw_leads.dedup_status = 'duplicate'`
- `raw_leads.unique_lead_id = existing_unique_lead.id`
- Update `unique_leads.last_seen_at`
- Append to `unique_leads.touch_sources`
- `unique_leads.total_touches += 1`
- Write `audit_log`: `action='dedup.duplicate_detected'`

### On UNIQUE
- `raw_leads.dedup_status = 'unique'`
- Create `unique_leads` row (see M-007)
- `raw_leads.unique_lead_id = new_unique_lead.id`
- Write `audit_log`: `action='dedup.unique_confirmed'`

---

## Acceptance Criteria

```
[ ] 1000 ingestions of the same phone → exactly 1 unique_lead + 1000 raw_leads (999 duplicate)
[ ] Same phone, different sources within 24h → 1 unique_lead, both raw_leads point to it
[ ] Same phone after 24h window (default) → new unique_lead (new_lead behavior)
[ ] Dedup window is configurable per org via dedup_rules.phone_window_hours
[ ] Dedup runs inside a DB transaction: no partial state if it fails
[ ] audit_log row per dedup decision
[ ] mih/lead.dedup_decided fires with { unique_lead_id, dedup_status, org_id }
[ ] Force-unmerge: mih_org_admin can manually split a cluster (V0 stub — just adds audit entry)
```

---

## Module Location

```
modules/identity/
  index.ts        exports: resolveDedup, getCluster, mergeCluster
  dedup.ts        main dedup algorithm
  graph.ts        identity_identifiers + identity_clusters CRUD
  rules.ts        reads dedup_rules for the org
```

---

## Inngest Events

| Event | Trigger | Consumed by |
|---|---|---|
| `mih/lead.ingested` | (from M-005) | dedup handler |
| `mih/lead.dedup_decided` | (fired here) | M-007 unique leads, M-008 CRM handoff |

---

## Migration File

`supabase/migrations/006_identity_graph.sql` (identity_clusters, identity_identifiers, RLS)
