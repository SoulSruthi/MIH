# Anti-Roadmap — What We Are NOT Building

This document exists to prevent scope creep. Any feature listed here has been explicitly deferred or rejected. If a stakeholder requests one of these items, point them here first.

---

## Deferred to V3+

| Feature | Reason | Condition for Reconsideration |
|---|---|---|
| Auto-push budget changes to Meta/Google Ads API | V2 is advisory only (H.17); API rate limits + human oversight required | V3 if >50 orgs request it |
| Multi-region Postgres (separate DB per org) | Complexity; RLS provides sufficient isolation below 500 orgs | >500 orgs with data residency requirements |
| Custom RBAC role builder | 6 fixed roles cover all use cases; custom roles create combinatorial explosion (H.08) | Enterprise tier with dedicated support |
| Real-time lead streaming (WebSockets) | Polling + SSE sufficient for current scale; WebSocket infra adds ops complexity | >10,000 concurrent users |
| WhatsApp / SMS lead ingestion | Email + form-based ingestion covers 90%+ of Indian RE market in V1 | Partner request from aggregator |
| AI agents with T3+ capabilities (autonomous mutations) | P7 ceiling at T2; human approval required for all consequential actions | Never without explicit security review |
| Predictive lead scoring using historical deal data | Requires ≥1000 closed deals per org for meaningful model; V2 intent scoring is sufficient | Post V1 production data accumulation |
| Offline mobile app | Web-first; PWA covers walk-in capture use case | Field sales team >100 people |
| Lead marketplace / benchmarking across orgs | Privacy; cross-org data sharing violates tenancy model (H.01) | Separate product with anonymization |

---

## Explicitly Rejected

| Feature | Reason |
|---|---|
| Shared DB credentials across orgs | Violates tenancy model; RLS must be enforced at all times |
| Storing unencrypted credentials | Security principle H.05 is non-negotiable |
| Raw SQL from LLM (text-to-SQL) | Injection risk; LLM accesses structured context only, not raw DB |
| Giving AI agents UPDATE/DELETE permissions | T2 ceiling (H.11); agents are advisory |
| Bypassing CRM HMAC verification | Replay protection is non-negotiable (H.07) |
| Per-lead billing to sub-orgs | Billing model is per-org; sub-billing creates audit complexity |
| Auto-suspend orgs without grace period | Grace period is 7 days (M-114); immediate suspension is too aggressive |

---

## "Not Yet" — Revisit After V1 Gate

| Feature | Why Wait |
|---|---|
| JustDial connector | API access negotiation in progress; will be M-115 if access granted |
| PropTiger connector | Same as JustDial; pending API partnership |
| Multi-CRM support (Salesforce, HubSpot) | V1 covers the partner CRM; multi-CRM adds contract parsing complexity |
| Anomaly alert via WhatsApp | Email-first (M-112); WhatsApp adds BSP registration overhead |
| Spend forecasting | Requires 6+ months of spend data; V2 cohort data is prerequisite |
