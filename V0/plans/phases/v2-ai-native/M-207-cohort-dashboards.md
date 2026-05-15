# M-207 · Cohort Retention Dashboards

**Depends on:** M-108 (attribution engine), M-109 (ROI dashboards)  
**Effort:** 4 days

## Purpose

Group leads by the week/month they were acquired and track their lifecycle progression over time. Answers questions like "Of all leads from Meta in Week 12, how many became deals by Week 20?"

## User Story

> As a marketing analyst, I want a cohort table showing how Meta leads from March convert to deals over 8 weeks, so I can compare cohort velocity across sources.

---

## Cohort Definition

A cohort is defined by:
- **Acquisition period:** the week or month a `unique_lead` was created
- **Source (optional filter):** filter cohort to a specific source/campaign

Each cohort row tracks:
- How many leads entered in that period
- What % reached each lifecycle stage (contacted, qualified, site_visit, deal, won) by each subsequent week

---

## Data Model

Cohort data is computed nightly and stored as projections (rebuildable).

Migration `0026_cohort_snapshots.sql`:
```sql
CREATE TABLE cohort_snapshots (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  cohort_period       text NOT NULL,     -- '2024-W12' | '2024-03'
  cohort_period_type  text NOT NULL,     -- 'week' | 'month'
  source_filter       text,              -- null = all sources; 'meta' | 'google' | etc.
  cohort_size         integer NOT NULL,  -- # unique_leads in this cohort
  weeks_since_acq     smallint NOT NULL, -- 0, 1, 2, ... 12
  contacted_pct       numeric(5,2),      -- % that reached contacted
  qualified_pct       numeric(5,2),
  site_visit_pct      numeric(5,2),
  deal_pct            numeric(5,2),
  won_pct             numeric(5,2),
  computed_at         timestamptz NOT NULL DEFAULT now(),
  model_version       text NOT NULL DEFAULT 'cohort_v1'
);

CREATE UNIQUE INDEX ON cohort_snapshots (
  organization_id, cohort_period, cohort_period_type, 
  COALESCE(source_filter,'_all'), weeks_since_acq
);
-- RLS: organization_id = app_org_id()
```

---

## Computation

Inngest cron `cohort.snapshot.nightly` at 05:00 IST:

```typescript
async function computeCohortSnapshots(orgId: string) {
  // For each (cohort_period × source_filter × weeks_since_acq):
  //   1. Find unique_leads created in that period (+ source filter)
  //   2. For each lifecycle stage, count leads that reached it by (cohort_start + weeks * 7)
  //   3. Upsert into cohort_snapshots
  //   Note: uses crm_lifecycle_events.occurred_at for stage timing
}
```

Computation is idempotent: upsert on the unique index.

---

## UI: Cohort Table

`/dashboard/cohort` page:

```
Source: [All ▼]  Period: [Week ▼]  Stage: [Qualified ▼]

Cohort      Size   Wk 0   Wk 1   Wk 2   Wk 4   Wk 8   Wk 12
2024-W10    142    100%   38%    52%    61%    68%    71%
2024-W11    98     100%   41%    55%    63%    —      —
2024-W12    201    100%   35%    —      —      —      —
```

- Color gradient: darker = higher conversion
- Dashes: future periods (cohort not old enough)
- Click a cell → drill down to individual leads in that cohort + stage

### Comparison View

Side-by-side cohort tables for two sources:
```
Meta Week 12 cohort vs. Google Week 12 cohort → qualified % by week
```

---

## In Scope

- Nightly cohort snapshot computation
- `/dashboard/cohort` page with cohort table
- Source + period + stage selectors
- Color-coded heatmap table
- Cell drill-down to lead list
- Source comparison view

## Module Location

```
modules/cohort/
  index.ts          — nightly computation orchestrator
  calculator.ts     — pure cohort computation function
  schema.ts
  __tests__/
    cohort-calculator.test.ts

app/
  dashboard/
    cohort/
      page.tsx          — cohort table page
      CohortTable.tsx   — heatmap table component
      CohortCell.tsx    — drill-down cell
      SourceComparison.tsx
```

## Acceptance Criteria

```
[ ] Cohort correctly assigns leads to acquisition week/month
[ ] Stage timing: uses crm_lifecycle_events.occurred_at, not created_at
[ ] Won % for Week 12 cohort matches manual calculation from raw events
[ ] Future periods show dash (not 0%)
[ ] Computation idempotent: nightly recompute produces same numbers
[ ] Source filter: "Meta only" cohort contains only meta source leads
[ ] Drill-down: clicking qualified cell at Week 4 shows correct lead list
[ ] Comparison view: two sources' cohort curves shown side by side correctly
[ ] Performance: cohort table loads in <500ms for 12 cohort periods × 6 sources
[ ] Coverage: 90% branch on cohort-calculator.ts
```
