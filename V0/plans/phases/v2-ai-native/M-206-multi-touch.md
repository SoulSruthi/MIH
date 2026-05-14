# M-206 · Multi-Touch Attribution

**Depends on:** M-108 (attribution engine V1 — extends it)  
**Effort:** 7 days

## Purpose

Extend the last-touch attribution engine to support first-touch, linear, and time-decay models. Each model produces its own set of `attribution_rollups` rows, tagged with `model_version`. Analysts can compare models to understand which sources truly drive outcomes vs. which just close leads.

## User Story

> As a marketing analyst, I want to see CPL and ROAS for Meta under first-touch vs. last-touch so I can understand if Meta is driving new awareness or just closing warm leads.

---

## Attribution Models

### Model 1: Last Touch V1 (existing, M-108)
Already implemented. `model_version = 'last_touch_v1'`

### Model 2: First Touch
100% credit to the first `raw_lead` source in the unique_lead's merge chain.

```
raw_leads chain:  [99acres → Meta → Meta]
                          ↑
                    first touch gets 100% credit
```

`model_version = 'first_touch_v1'`

### Model 3: Linear
Credit distributed equally across all distinct source touchpoints in the merge chain.

```
raw_leads chain:   [99acres → Meta → Meta]
Distinct sources:  [99acres, Meta]
Credit:            99acres = 50%, Meta = 50%
```

`model_version = 'linear_v1'`

### Model 4: Time Decay
Exponential decay: touches closer to the conversion event get more credit.

```
Decay formula: weight = e^(-λ × days_before_conversion)
λ = 0.1 (configurable per org)
```

`model_version = 'time_decay_v1'`

---

## Engine Architecture

```
attribution/
  models/
    last-touch.ts       — existing
    first-touch.ts      — new
    linear.ts           — new
    time-decay.ts       — new
  rollup-writer.ts      — writes to attribution_rollups (shared, model-agnostic)
  recompute.ts          — nightly full recompute for all 4 models
```

All models are **pure functions**:
```typescript
type AttributionModel = (
  mergeChain: RawLead[],
  conversionEvent: CRMEvent,
  spendData: SpendDaily[]
) => AttributionCredit[];

interface AttributionCredit {
  source_id:        string;
  campaign_id:      string | null;
  ad_id:            string | null;
  credit_fraction:  number;   // 0.0–1.0; sum across all credits = 1.0
}
```

---

## Rollup Schema Extension

The existing `attribution_rollups` table already has `model_version`. No schema changes needed — same table, new rows per model.

### Nightly Recompute

Inngest cron `attribution.rollup.all_models` at 04:00 IST:
1. Delete all rollup rows for `model_version IN ('first_touch_v1','linear_v1','time_decay_v1')` for last 90 days
2. Recompute from unique_leads + crm_lifecycle_events + spend_daily
3. Write new rows

Recompute is idempotent: delete-then-insert, not upsert.

---

## UI: Model Comparison

`/dashboard/roi` gains a model selector:
```
[Last Touch ▼] [First Touch] [Linear] [Time Decay]
Compare: [Last Touch vs First Touch]
```

Comparison view: side-by-side CPL/CPA/ROAS per source for two selected models. Highlights sources where model choice changes rank order (indicating assisted vs. closing sources).

---

## In Scope

- 3 new attribution model implementations (first-touch, linear, time-decay)
- Updated nightly recompute to run all 4 models
- Model selector in ROI dashboard UI
- Model comparison view (side-by-side)
- λ (decay rate) configurable per org in org settings

## Module Location

```
modules/attribution/
  models/
    first-touch.ts
    linear.ts
    time-decay.ts
  __tests__/
    first-touch.test.ts
    linear.test.ts
    time-decay.test.ts
    model-comparison.test.ts   — same inputs, verify all 4 produce valid credits summing to 1.0
```

## Acceptance Criteria

```
[ ] first-touch: 100% credit to first raw_lead source in merge chain
[ ] linear: credit split equally across distinct sources
[ ] time-decay: closer-to-conversion touches get higher weight; weights sum to 1.0
[ ] All models: credits sum to exactly 1.0 (or within floating-point tolerance 1e-6)
[ ] Nightly recompute: all 4 models recomputed; idempotent (run twice → same result)
[ ] ROI dashboard: model selector switches CPL/CPA/ROAS correctly
[ ] Comparison view: highlights when model choice changes source rank order
[ ] Attribution is pure: same inputs → same outputs (no side effects, no randomness)
[ ] λ override: org with custom decay rate produces different results than default
[ ] Coverage: 100% branch on credit-fraction math (safety-critical financial calculation)
```
