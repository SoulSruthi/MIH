# V1 Marketing Operations — Phase Overview

**Duration:** ~6 weeks (starts after V0 acceptance gate passes)  
**Goal:** Full multi-source lead ingestion + spend tracking + ROI dashboards.  
**Directives:** M-101 through M-114 (14 total)

---

## V1 End-State

A marketing manager can:
1. See leads from 6+ sources in one place (Meta, Google, 99acres, MagicBricks, Housing.com, JustDial + walk-ins)
2. View daily spend per source/campaign automatically synced
3. See ROI metrics: CPL, CPA, ROAS at source / campaign / ad granularity
4. Configure dedup rules (window, email match, fuzzy phone)
5. Investigate and replay failed lead ingestion from the DLQ UI
6. Invite team members and assign roles

---

## Directive Sequence

```
M-101 Google Ads connector
  └── DEPENDS ON: M-003 (framework)

M-102 99acres connector
  └── DEPENDS ON: M-003

M-103 MagicBricks connector
  └── DEPENDS ON: M-003

M-104 Housing.com connector
  └── DEPENDS ON: M-003

M-105 Manual lead entry
  └── DEPENDS ON: M-005 (ingestion pipeline)

M-106 Dedup rule editor
  └── DEPENDS ON: M-006 (dedup engine)

M-107 Spend tracking
  └── DEPENDS ON: M-101 (Google), M-004 (Meta) for API pull;
      M-105 for manual entry

M-108 Attribution engine V1
  └── DEPENDS ON: M-007, M-009, M-107

M-109 ROI dashboards
  └── DEPENDS ON: M-108

M-110 Lead detail panel
  └── DEPENDS ON: M-007, M-008, M-009

M-111 User management UI
  └── DEPENDS ON: M-002 (RBAC)

M-112 Anomaly alerts V1
  └── DEPENDS ON: M-109 (ROI dashboards)

M-113 DLQ management UI
  └── DEPENDS ON: M-003 (connector_dlq table)

M-114 Billing integration
  └── DEPENDS ON: M-001 (org model)
```

---

## V1 Acceptance Gate

```
[ ] 6+ sources connected and ingesting for at least one test org
[ ] Spend tracked: manual entry working for all source kinds
[ ] Attribution rollups: correct CPL per source for last 30 days
[ ] ROI dashboard: renders with ≤500ms for 10,000 leads
[ ] Dedup rule editor: org admin can configure window + email match + fuzzy
[ ] DLQ UI: ops can view + replay failed ingestion records
[ ] User management: invite + role assign + remove working
[ ] Anomaly alert: email fires when CPL spikes >50% week-over-week
[ ] Billing: Stripe subscription checkout working
[ ] Coverage: 80% lines, 90% branches on all M-101 through M-114 modules
```

---

## Directives Summary

| Directive | Title | Effort |
|---|---|---|
| M-101 | Google Ads connector | 5 days |
| M-102 | 99acres connector | 4 days |
| M-103 | MagicBricks connector | 4 days |
| M-104 | Housing.com connector | 4 days |
| M-105 | Manual lead entry (walk-in form + CSV upload) | 1 day |
| M-106 | Dedup rule editor UI | 2 days |
| M-107 | Spend tracking (API pull + manual entry) | 4 days |
| M-108 | Attribution engine V1 (last-touch) | 5 days |
| M-109 | ROI dashboards (CPL, CPA, ROAS) | 5 days |
| M-110 | Lead detail panel | 3 days |
| M-111 | User management UI | 2 days |
| M-112 | Anomaly alerts V1 | 3 days |
| M-113 | DLQ management UI | 2 days |
| M-114 | Billing integration (Stripe) | 3 days |
| **Total** | | **~47 dev-days / ~9–10 weeks** |
