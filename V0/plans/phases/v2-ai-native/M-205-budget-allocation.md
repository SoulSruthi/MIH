# M-205 · AI Budget Allocation Recommendations

**Depends on:** M-108 (attribution engine), M-107 (spend data)  
**Effort:** 5 days

## Purpose

AI analyzes historical spend efficiency across sources and campaigns and recommends how to reallocate the monthly marketing budget to maximize leads or deals. All recommendations require explicit human approval. MIH never autonomously moves money.

## User Story

> As a marketing manager, I want an AI recommendation for how to allocate next month's ₹10L budget across Meta, Google, and 99acres, with the reasoning shown so I can decide whether to follow it.

---

## T2 Ceiling (P7)

Same constraint as M-204: AI recommends, human approves, system executes. No autonomous budget movement.

---

## Recommendation Model

### Input Data (last 90 days)

```typescript
interface SourceEfficiency {
  source:           string;
  total_spend_inr:  number;
  unique_leads:     number;
  qualified_leads:  number;
  deals_won:        number;
  cpl:              number;     // cost per unique lead
  cpa:              number;     // cost per deal (null if no deals)
  avg_quality_grade: number;   // composite 0-100
  trend:            'improving' | 'stable' | 'degrading';
  confidence:       'high' | 'medium' | 'low';  // based on data recency + volume
}
```

### Allocation Algorithm

Two-pass approach:
1. **Efficiency ranking** (pure data) — rank sources by CPA (primary) → CPL (secondary) → quality grade (tertiary)
2. **AI narrative** (Sonnet) — generate allocation recommendation + rationale with confidence ranges

```typescript
interface BudgetRecommendation {
  total_budget_inr:     number;
  period:               string;           // 'next_month'
  allocations: Array<{
    source:             string;
    recommended_inr:    number;
    confidence_low:     number;           // ₹ lower bound
    confidence_high:    number;           // ₹ upper bound
    rationale:          string;           // 2-3 sentence explanation
    change_from_current: number;          // delta vs. current allocation
  }>;
  overall_rationale:    string;
  expected_leads_range: [number, number]; // predicted lead count range
  expected_cpl_range:   [number, number];
  data_quality_warnings: string[];        // e.g., "Google has only 14 days of data"
  model_version:        string;
}
```

### Confidence Gates

- Source with <14 days data → `confidence: 'low'`, wide range, explicit warning
- Source with <30 days → `confidence: 'medium'`
- Source with ≥30 days + ≥50 leads → `confidence: 'high'`

---

## Approval Workflow

```
1. Analyst clicks "Generate Recommendation" on /dashboard/budget-allocation
2. Input: total budget for next month (INR) + lock any sources (e.g., "keep 99acres spend")
3. System computes efficiency → Sonnet generates narrative
4. Recommendation shown with confidence ranges + supporting charts
5. Analyst: [Accept All] [Modify] [Reject]
6. Accept → logged to budget_recommendations table (does NOT push to ad platforms)
7. Analyst manually implements in Meta/Google dashboards (V2 does not auto-push spend)
```

> V2 scope: recommendations only. Auto-push to Meta/Google Ads API is V3.

---

## In Scope

- `/dashboard/budget-allocation` — recommendation UI
- Budget input form: total INR, period, locked sources
- Efficiency table showing current vs. recommended allocation
- Confidence range bars per source
- Historical recommendation archive

## Database

Migration `0025_budget_recommendations.sql`:
```sql
CREATE TABLE budget_recommendations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id),
  created_by        uuid NOT NULL REFERENCES auth.users(id),
  input_budget_inr  numeric(12,2) NOT NULL,
  period_label      text NOT NULL,               -- '2024-08'
  recommendation    jsonb NOT NULL,              -- full BudgetRecommendation object
  status            text NOT NULL DEFAULT 'pending',
  -- pending | accepted | rejected | superseded
  reviewed_by       uuid REFERENCES auth.users(id),
  reviewed_at       timestamptz,
  agent_action_id   uuid REFERENCES agent_actions(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);
-- RLS: organization_id = app_org_id()
```

## Module Location

```
modules/ai/
  budget-allocator/
    index.ts              — orchestrator
    efficiency-ranker.ts  — pure efficiency ranking (no LLM)
    narrator.ts           — Sonnet narrative generation
    confidence.ts         — confidence gate logic
    schema.ts
  __tests__/
    budget-allocator.test.ts
    efficiency-ranker.test.ts

app/
  dashboard/
    budget-allocation/
      page.tsx             — recommendation UI
      AllocationTable.tsx  — per-source table with confidence ranges
      BudgetInput.tsx      — total budget + locked sources form
```

## Acceptance Criteria

```
[ ] Recommendation generated within 30 seconds for ≤6 sources
[ ] Confidence ranges present for every source allocation
[ ] Source with <14 days data → warning shown; confidence_low/high spread is ≥40%
[ ] Data quality warnings listed at top of recommendation
[ ] Accepted recommendation logged to budget_recommendations table
[ ] No API calls to Meta/Google made by MIH (manual implementation by analyst)
[ ] Previous recommendations accessible in archive (last 6 months)
[ ] Agent_actions logged: Sonnet call + input hash + cost
[ ] Locked sources: analyst can pin a source's budget; recommendation treats it as fixed
```
