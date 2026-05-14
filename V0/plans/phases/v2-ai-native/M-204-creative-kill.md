# M-204 · AI Creative Kill Recommendations

**Depends on:** M-203 (diagnostic chat infrastructure)  
**Effort:** 5 days

## Purpose

AI analyzes ad creative performance and recommends which creatives to pause or kill. All recommendations require explicit human approval before any action is taken. MIH never autonomously modifies ad campaigns.

## User Story

> As a marketing manager, I want AI to flag underperforming creatives so I can pause them with one click — but I want to review the recommendation first before anything changes.

---

## T2 Ceiling: No Autonomous Action (P7)

```
AI role:    Draft recommendation with supporting data
Human role: Review + Approve or Reject
System:     Only executes after human clicks "Approve"
Audit:      Every recommendation (approved or rejected) → audit_log
```

The system NEVER:
- Automatically pauses or stops an ad
- Makes API calls to Meta/Google without explicit human approval
- Re-submits a rejected recommendation automatically

---

## Recommendation Engine

### Trigger
- Inngest cron `creative.recommendations.daily` at 08:00 IST
- Analyzes creatives with ≥3 days of data and ≥100 impressions

### Kill Signal Formula

```typescript
interface CreativeSignals {
  cpl:            number;     // current 7-day average CPL
  baseline_cpl:   number;     // org's baseline CPL for same source
  ctr:            number;     // click-through rate
  lead_quality:   number;     // avg quality composite score of leads from this creative
  spend_inr:      number;     // total spend last 7 days
  days_running:   number;
}

function shouldRecommendKill(s: CreativeSignals): boolean {
  const cpl_ratio = s.cpl / s.baseline_cpl;
  const poor_quality = s.lead_quality < 40;
  return (
    (cpl_ratio > 2.0 && s.days_running >= 3) ||   // CPL >2× baseline for 3+ days
    (cpl_ratio > 1.5 && poor_quality) ||            // CPL 1.5× + poor quality leads
    (s.ctr < 0.005 && s.spend_inr > 5000)           // <0.5% CTR and meaningful spend
  );
}
```

### AI Explanation Generation

For each flagged creative, Haiku generates a 2–3 sentence explanation:
- Why it's recommended for pausing (which signals triggered it)
- What the baseline comparison is
- Suggested alternative action (pause vs. reduce budget vs. restructure)

---

## Approval Workflow

```
1. Cron generates recommendations → pending_creative_actions table
2. Org admin / marketing_ops sees "Recommendations waiting" badge
3. Review page: /dashboard/creative-recommendations
4. Per recommendation: [Approve] [Reject] [Snooze 7 days]
5. Approve → MIH calls Meta/Google API to pause the ad unit
6. Reject → logged with rejection reason (optional text); not re-surfaced for 14 days
7. All actions → audit_log
```

## Database

Migration `0024_creative_actions.sql`:
```sql
CREATE TABLE pending_creative_actions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  action_type     text NOT NULL DEFAULT 'pause_creative',
  source          text NOT NULL,              -- 'meta' | 'google'
  creative_id     text NOT NULL,              -- platform's ad/creative ID
  creative_name   text,
  signals_json    jsonb NOT NULL,             -- CPL, CTR, quality data that triggered
  ai_explanation  text NOT NULL,
  ai_confidence   text NOT NULL,             -- 'high' | 'medium' | 'low'
  status          text NOT NULL DEFAULT 'pending',
  -- pending | approved | rejected | snoozed | executed | failed
  reviewed_by     uuid REFERENCES auth.users(id),
  reviewed_at     timestamptz,
  rejection_reason text,
  snooze_until    timestamptz,
  executed_at     timestamptz,
  execution_error text,
  agent_action_id uuid REFERENCES agent_actions(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
-- RLS: organization_id = app_org_id()
```

## Module Location

```
modules/ai/
  creative-kill/
    index.ts              — daily cron orchestrator
    signal-calculator.ts  — pure kill-signal formula
    explainer.ts          — Haiku explanation generation
    executor.ts           — Meta/Google pause API calls (only on approval)
    schema.ts
  __tests__/
    creative-kill.test.ts
    signal-calculator.test.ts

app/
  dashboard/
    creative-recommendations/
      page.tsx             — recommendations list
      ReviewCard.tsx       — per-recommendation card with approve/reject
```

## Acceptance Criteria

```
[ ] Creative with CPL >2× baseline for 3+ days → recommendation generated
[ ] AI explanation: cites specific CPL ratio and spend amount
[ ] No ad paused without explicit human approval click
[ ] Approve → Meta/Google API called → ad paused → execution logged
[ ] Reject → recommendation removed from queue → not re-surfaced for 14 days
[ ] Snooze 7 days → reappears after snooze period if still underperforming
[ ] All approve/reject actions → audit_log with actor + timestamp
[ ] Execution failure: logged in pending_creative_actions.execution_error; admin alerted
[ ] Coverage: signal-calculator.ts: 100% branch coverage (safety-critical formula)
```
