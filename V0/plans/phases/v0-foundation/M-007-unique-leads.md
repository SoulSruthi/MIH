# M-007 · Unique Leads Projection

**Depends on:** M-006  
**Effort:** 2 days  
**V5 build prompt:**
```
Build feature: unique leads projection — unique_leads table, merge/unique decision
from dedup engine, crm_external_id assignment, touch_sources JSONB update,
real-estate preference fields
```

---

## Purpose

One `unique_leads` row per real person per org. The curated record that gets handed to the CRM.

---

## In Scope

### On `mih/lead.dedup_decided` where `dedup_status='unique'`

Create a new `unique_leads` row:
```ts
{
  organization_id: raw_lead.organization_id,
  identity_cluster_id: new_cluster.id,
  primary_phone_e164: raw_lead.phone_e164,
  primary_email: raw_lead.email,
  primary_name: raw_lead.name,
  first_seen_at: raw_lead.source_received_at,
  last_seen_at: raw_lead.source_received_at,
  primary_source_id: raw_lead.source_id,
  total_touches: 1,
  touch_sources: [{ source_id, source_campaign_id, source_ad_id, touched_at }],
  preference_bhk: normalized from raw_lead fields,
  preference_budget_band: normalized,
  preference_location: normalized,
  crm_external_id: `mih_${org_id_prefix}_${raw_lead.id}`,  // stable, unique
  crm_handoff_status: 'pending',
}
```

### On `mih/lead.dedup_decided` where `dedup_status='duplicate'`

Update existing `unique_leads`:
```ts
{
  last_seen_at: raw_lead.source_received_at,
  total_touches: += 1,
  touch_sources: append { source_id, source_campaign_id, touched_at },
}
```

### `crm_external_id` format
`mih_{6-char-org-slug}_{raw_lead_uuid_without_hyphens}`  
Must be globally unique. Used as idempotency key when POSTing to CRM.

---

## Acceptance Criteria

```
[ ] unique_leads row created for every raw_lead with dedup_status='unique'
[ ] crm_external_id is stable: same raw_lead_id always produces the same external_id
[ ] crm_external_id is globally unique (UNIQUE constraint)
[ ] touch_sources JSONB updated correctly on duplicate detection
[ ] total_touches increments correctly
[ ] UNIQUE (organization_id, primary_phone_e164) prevents two unique_leads for same phone
[ ] crm_handoff_status starts as 'pending'
[ ] Preference fields mapped from raw_lead form fields (null if not present)
```

---

## Module Location

```
modules/leads/
  index.ts          exports: createUniqueLead, updateTouches, getUniqueLead
  projection.ts     create/update unique_leads from dedup decision
  external-id.ts    crm_external_id generation + validation
  preference.ts     real-estate field normalization (BHK, budget_band)
```

---

## Migration File

`supabase/migrations/007_unique_leads.sql` (unique_leads table + indexes + RLS)
