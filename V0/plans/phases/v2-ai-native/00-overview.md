# V2 AI-Native — Phase Overview

**Duration:** ~6 weeks (starts after V1 acceptance gate passes)  
**Goal:** AI features built on top of clean, attributed data from V0 + V1.  
**Directives:** M-201 through M-207 (7 total)

**Pre-condition:** V2 AI features are ONLY valuable after V0 + V1 have produced at least 90 days of clean attribution data. Do not start V2 until V1 has been in production for ≥30 days with real data.

---

## V2 End-State

A marketing analyst can:
1. Ask "Why did Meta CPL spike last week?" and get an AI-generated diagnosis
2. See AI intent score (0-100) and quality grade (A/B/C/D) on every lead before CRM handoff
3. Get AI recommendations for which creatives to kill (requires human approval before action)
4. See budget allocation recommendations across sources (requires approval)
5. Compare attribution across first-touch, last-touch, linear, and time-decay models
6. View cohort retention dashboards: "Of all leads from Meta in Week 12, how many became deals by Week 20?"

---

## AI Architecture Principles for V2

- **All AI agents ≤ T2** (per P7). MIH AI agents draft actions; humans approve.
- **AI Gateway pattern** (same as CRM): Anthropic primary, OpenAI fallback, per-org token budget
- **Confidence-gated:** AI scores shown with confidence; low-confidence outputs labeled
- **Audit trail:** every AI call logged to `agent_actions` table with input + output + cost
- **Prompt injection defense:** all user-sourced data sanitized before LLM input

---

## Directive Sequence

```
M-201 AI intent scoring
  └── DEPENDS ON: M-007 (unique_leads), AI gateway

M-202 AI quality grading
  └── DEPENDS ON: M-201 (builds on same pipeline)

M-203 AI diagnostic chat
  └── DEPENDS ON: M-108 (attribution engine), M-109 (ROI data)

M-204 AI creative kill recommendations
  └── DEPENDS ON: M-203 (diagnostic chat infrastructure)

M-205 AI budget allocation recommendations
  └── DEPENDS ON: M-108, M-107 (spend data)

M-206 Multi-touch attribution
  └── DEPENDS ON: M-108 (extends existing attribution engine)

M-207 Cohort retention dashboards
  └── DEPENDS ON: M-108, M-109
```

---

## V2 Acceptance Gate

```
[ ] AI intent scores populated on ≥95% of new unique_leads within 60 sec
[ ] AI grades accurate: manually review 100 leads; grade correlation ≥80% with expert judgment
[ ] Diagnostic chat: answers "why did CPL change" question with ≥3 supporting data points
[ ] Creative kill recommendations require explicit human approval before any action
[ ] Budget recommendations include confidence range and supporting attribution data
[ ] Multi-touch models: first-touch, linear, time-decay all produce valid rollups
[ ] Cohort dashboard: correct cohort assignment + outcome tracking
[ ] AI costs tracked per org; no org exceeds budget without alert
[ ] Coverage: 80% lines, 90% branches on all M-201 through M-207 modules
```

---

## Directives Summary

| Directive | Title | Effort |
|---|---|---|
| M-201 | AI intent scoring | 5 days |
| M-202 | AI quality grading | 3 days |
| M-203 | AI diagnostic chat | 7 days |
| M-204 | AI creative kill recommendations | 5 days |
| M-205 | AI budget allocation recommendations | 5 days |
| M-206 | Multi-touch attribution | 7 days |
| M-207 | Cohort retention dashboards | 4 days |
| **Total** | | **~36 dev-days / ~7–8 weeks** |
