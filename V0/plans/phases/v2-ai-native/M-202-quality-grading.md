# M-202 · AI Quality Grading

**Depends on:** M-201 (intent scoring pipeline)  
**Effort:** 3 days

## Purpose

Assign a quality grade (A/B/C/D) to every unique_lead based on intent score + additional signal. Grades drive CRM triage priority and optional routing rules.

## Grade Definitions

| Grade | Intent Score | Meaning | Default CRM Action |
|---|---|---|---|
| A | 80–100 | High-intent, likely buyer | Priority queue, call within 2h |
| B | 60–79 | Moderate intent, needs nurturing | Standard queue, call within 24h |
| C | 40–59 | Low intent, early-stage | Nurture sequence |
| D | 0–39 | Very low intent / likely spam | Deprioritized; review before calling |

## Additional Grading Signals (beyond intent score)

| Signal | Weight | Notes |
|---|---|---|
| intent_score | primary | from M-201 |
| budget_range | modifier | >1.2Cr → +5 pts; <50L → -5 pts |
| previous_enquiries | modifier | 2–5 → +3 pts; >5 → -5 pts (serial enquirer) |
| email_domain_type | modifier | corporate → +3; temp/disposable → -10 |
| source_channel | modifier | walk_in → +10 (high-intent by nature) |
| phone_type | modifier | VoIP → -5 |

## Grade Computation

Grade is derived from a composite score (not a separate LLM call — derived from M-201 output + rules):

```typescript
function computeGrade(
  intentScore: number,
  modifiers: LeadModifiers
): { grade: 'A' | 'B' | 'C' | 'D'; composite: number } {
  let score = intentScore;
  if (modifiers.budgetRange === '>1.2Cr') score += 5;
  if (modifiers.budgetRange === '<50L') score -= 5;
  if (modifiers.previousEnquiries >= 2 && modifiers.previousEnquiries <= 5) score += 3;
  if (modifiers.previousEnquiries > 5) score -= 5;
  if (modifiers.emailDomainType === 'corporate') score += 3;
  if (modifiers.emailDomainType === 'temp') score -= 10;
  if (modifiers.sourceChannel === 'walk_in') score += 10;
  if (modifiers.phoneType === 'voip') score -= 5;
  const composite = Math.max(0, Math.min(100, score));
  const grade = composite >= 80 ? 'A' : composite >= 60 ? 'B' : composite >= 40 ? 'C' : 'D';
  return { grade, composite };
}
```

> Note: Grade is a pure function of intent_score + modifiers. No additional LLM call needed. This keeps M-202 fast and cheap.

---

## In Scope

- `modules/ai/quality-grader/` — pure function, no LLM call
- Runs immediately after M-201 score is written (same Inngest chain)
- Writes `quality_grade` + `quality_composite_score` to `unique_leads`
- Grade shown in Lead List, Lead Detail Panel (M-110), CRM handoff payload
- Grade included in CRM handoff: `POST /api/sister/v1/leads` body gets `ai_grade` field
- Manual override: marketing_ops can override grade with reason → logged to `audit_log`

## Database

`unique_leads` additions (same migration `0021_ai_intent_score.sql`):
```sql
ALTER TABLE unique_leads
  ADD COLUMN quality_grade            text CHECK (quality_grade IN ('A','B','C','D')),
  ADD COLUMN quality_composite_score  smallint CHECK (quality_composite_score BETWEEN 0 AND 100),
  ADD COLUMN quality_grade_overridden boolean DEFAULT false,
  ADD COLUMN quality_grade_override_reason text;
```

## Module Location

```
modules/ai/
  quality-grader/
    index.ts      — grade computation (pure function)
    modifiers.ts  — modifier constants + lookup logic
    schema.ts     — zod schemas
  __tests__/
    quality-grader.test.ts
```

## Acceptance Criteria

```
[ ] Every scored lead (intent_score not null) gets quality_grade within 5 seconds
[ ] Grade A: composite ≥80; B: 60–79; C: 40–59; D: <40
[ ] Walk-in leads: grade never D unless intent_score itself is <20
[ ] Disposable email: -10 modifier applied correctly
[ ] CRM handoff payload includes ai_grade field
[ ] Manual override: grade change logged to audit_log with actor + reason
[ ] Grade accuracy: on 100 manually reviewed leads, correlation with expert judgment ≥80%
[ ] Re-grading: idempotent — same inputs always produce same grade
```
