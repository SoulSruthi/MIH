# Directive 006 — Dedup Engine + Identity Graph

**Created:** 2026-05-14T00:00:00Z  
**Slug:** dedup-engine  
**Phase:** V0  
**Depends on:** M-005 (ingestion pipeline)

---

## Intent

Build the dedup engine that processes `mih/lead.ingested` events, decides whether each raw_lead is UNIQUE or DUPLICATE using phone-based matching within a configurable time window, maintains the identity graph (clusters + identifiers), creates `unique_leads` projections, and fires `mih/lead.dedup_decided`.

---

## Scope

### Database (migration 006)
- `identity_clusters` — one cluster per real-world person
- `identity_identifiers` — phone_e164 (and future: email, crm_id) lookup keys
- `unique_leads` — projection: one row per unique person per org
- `dedup_rules` — per-org config: window hours + post-window behavior
- FK from `raw_leads.unique_lead_id` to `unique_leads.id`

### Module: `src/modules/identity/`
- `types.ts` — shared interfaces
- `rules.ts` — fetch per-org dedup rules (defaults: 24h window, new_lead behavior)
- `graph.ts` — all Supabase CRUD for identity tables
- `dedup.ts` — V0 phone-based dedup algorithm
- `index.ts` — public exports: `resolveDedup`, `getCluster`, `getOrgDedupRules`

### Algorithm (V0 phone-based)
1. Load org dedup rules  
2. Lookup phone in `identity_identifiers`  
3a. Found → get cluster → get unique_lead → check window:
   - Within window → DUPLICATE (update unique_lead, point raw_lead)
   - Past window + `new_lead` → new unique_lead  
   - Past window + `merge_existing` → DUPLICATE (merge into existing)  
3b. Not found → create cluster + identifier + unique_lead → UNIQUE  
4. Update `raw_leads.dedup_status` + `unique_lead_id`  
5. Write `audit_log` per decision  
6. Fire `mih/lead.dedup_decided`

---

## Acceptance Criteria

- [ ] Same phone × 1000 → exactly 1 unique_lead, 999 duplicates
- [ ] Same phone, two sources, within window → 1 unique_lead, both raw_leads point to it
- [ ] Same phone after window → new unique_lead (new_lead behavior)
- [ ] Window configurable per org via `dedup_rules.phone_window_hours`
- [ ] `audit_log` row per dedup decision
- [ ] `mih/lead.dedup_decided` fires with `{ unique_lead_id, dedup_status, org_id }`
- [ ] Force-unmerge stub: mih_org_admin can audit-log a manual split (V0 stub)

---

## Test Coverage Targets

- Lines ≥ 80%; Branches ≥ 90%
- Acceptance tests: 100% pass rate
