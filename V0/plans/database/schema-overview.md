# Database Schema Overview

**Canonical source:** `plans/database/schema-v0.sql`  
**Status:** V0 schema locked. Changes via additive migration only (migration-supabase-safe skill).

---

## Three-Layer Architecture

```
LAYER 1: SUBSTRATE (immutable, append-only — NEVER update these)
  raw_leads               one row per source ingestion event
  crm_lifecycle_events    one row per CRM lifecycle webhook received
  spend_daily             one row per (source × campaign × date) spend record
  audit_log               one row per state-changing action anywhere in system

LAYER 2: IDENTITY (mutable but reversible)
  identity_identifiers    phone, email, ad_platform_id per cluster
  identity_clusters       the "person" node; what raw_leads resolve to
  unique_leads            projection: one per real person per org

LAYER 3: PROJECTIONS (fully derived — delete and rebuild if corrupted)
  attribution_rollups     pre-aggregated CPL/CPA/ROAS per (source × campaign × date × model)
  outbound_deliveries     CRM handoff attempt log
  source_health_log       connector health score history (V1)

SUPPORTING (operational, low-churn)
  organizations           one per builder org
  memberships             user × org × role
  credentials             encrypted OAuth tokens, API keys, HMAC secrets
  sources                 one per connected ad platform per org
  dedup_rules             per-org dedup configuration
  campaigns               one per (source × vendor campaign_id)
  agent_actions           AI agent action log (V2+)
```

---

## Why Three Layers

**The fundamental invariant:** If any projection is corrupted (bug, failed migration, incorrect attribution model), you can delete the projection table and rebuild it by replaying the substrate.

This means:
- You can fix attribution bugs without losing historical data
- You can re-run dedup with different rules
- You can add new attribution models without touching source data
- You can recover from AI scoring errors

**Do not violate this** by writing derived values back into substrate tables.

---

## Table Summary

| Table | Layer | RLS | Mutable | Notes |
|---|---|---|---|---|
| `organizations` | Supporting | No (service role only) | Yes | Org lifecycle |
| `memberships` | Supporting | Yes | Yes | User × org × role |
| `credentials` | Supporting | Yes | No (rotate = new row) | Encrypted secrets |
| `sources` | Supporting | Yes | Yes | One per platform per org |
| `dedup_rules` | Supporting | Yes | Yes | Per-org config |
| `campaigns` | Supporting | Yes | Yes | Synced from vendor |
| `raw_leads` | Substrate | Yes | **NEVER** | Append-only |
| `crm_lifecycle_events` | Substrate | Yes | **NEVER** | Append-only |
| `spend_daily` | Substrate | Yes | No (supersede pattern) | Append-only |
| `audit_log` | Substrate | No (service role) | **NEVER** | Guarded by trigger |
| `identity_identifiers` | Identity | Yes | Yes (confidence updates) | Phone/email/etc |
| `identity_clusters` | Identity | Yes | Yes (merge operations) | Person node |
| `unique_leads` | Identity | Yes | Yes | Projection on identity graph |
| `outbound_deliveries` | Projection | Yes | Yes | CRM handoff attempts |
| `attribution_rollups` | Projection | Yes | Yes (recomputed) | Nightly rebuild |

---

## V0 vs V1 vs V2 Schema Evolution

| What | V0 | V1 addition | V2 addition |
|---|---|---|---|
| Dedup identifiers | phone only | email, fuzzy name | AI embeddings |
| Attribution models | last-touch only | `model_version` column already in schema | first-touch, linear, time-decay |
| Spend | manual entry only | API pull columns on `spend_daily` | — |
| AI enrichment | schema columns present, NULL | — | populated by V2 agents |
| Audit log retention | 90 days | per-org override | — |
| `raw_payload` storage | inline JSONB | archived to Supabase Storage after 90d | — |

V0 schema is already designed to be forward-compatible with V1 and V2 — no destructive migrations needed.
