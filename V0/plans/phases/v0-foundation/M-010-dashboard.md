# M-010 · Basic Dashboard

**Depends on:** M-007, M-008, M-009  
**Effort:** 3 days  
**V5 build prompt:**
```
Build feature: basic dashboard — RSC page at /dashboard with today/week/month lead counts
(raw + unique + dedup delta), leads by source table + bar chart, CRM handoff status counts,
recent 50 leads table with name/phone/source/dedup/handoff columns
```

---

## Purpose

First view that proves MIH works end-to-end. Visible to all roles except `super_admin`.

---

## In Scope

### Page: `/dashboard`

**Permission required:** `dashboard:view:org`

### Widget 1 — Lead Volume Summary (top of page)

Three periods (today / this week / this month):
- Raw leads count
- Unique leads count
- Duplicates saved (raw - unique)
- % dedup rate

### Widget 2 — CRM Handoff Status

Counts for current period:
- `pending` (queued, not yet attempted)
- `succeeded`
- `failed` (final failure, in DLQ)

### Widget 3 — Leads by Source

Table + horizontal bar chart:

| Source | Raw | Unique | Dup % | CRM Success |
|---|---|---|---|---|
| Meta Lead Ads | 420 | 310 | 26% | 309 |
| Walk-in | 45 | 45 | 0% | 45 |

### Widget 4 — Recent 50 Leads

Table, sorted by `ingested_at DESC`:

| Name | Phone | Source | Dedup Status | CRM Handoff |
|---|---|---|---|---|
| Ravi Kumar | +91987... | Meta | unique | succeeded |
| Priya S | +91876... | Walk-in | duplicate | skipped |

Phone shown as `+91987...XXXX` (masked for non-admin roles).

### Date range filter (today / 7d / 30d / custom)

---

## Acceptance Criteria

```
[ ] org_viewer: can see dashboard, phone numbers masked
[ ] marketing_ops: full dashboard with unmasked phones
[ ] super_admin: cannot see /dashboard without impersonation
[ ] Widget 1: raw count matches raw_leads table count for period
[ ] Widget 2: handoff counts correct
[ ] Widget 3: source breakdown correct; chart renders with shadcn
[ ] Widget 4: last 50 leads, correct columns, sorted by ingested_at DESC
[ ] Page loads < 500ms for orgs with up to 10,000 leads (Postgres query time)
[ ] Loading states shown while data fetches
```

---

## Tech Approach

- RSC page with async Server Components for each widget
- Direct Supabase queries (no ORM), scoped by user JWT (RLS active)
- shadcn `Table`, `Card`, `Badge` components
- Bar chart: recharts or shadcn chart component
- No client-side data fetching in V0 (no real-time yet — V1+)

---

## Module Location

```
app/(app)/dashboard/
  page.tsx              RSC page (assembles widgets)
  _components/
    lead-volume-card.tsx
    handoff-status-card.tsx
    leads-by-source.tsx
    recent-leads-table.tsx
modules/analytics/
  index.ts              exports: getDashboardMetrics, getRecentLeads
  queries.ts            Postgres queries for dashboard widgets
```
