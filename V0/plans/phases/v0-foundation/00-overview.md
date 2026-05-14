# V0 Foundation — Phase Overview

**Duration:** ~6 weeks  
**Goal:** Prove the product works end-to-end with one real source and one CRM connection.  
**Directives:** M-001 through M-012 (12 total)

---

## V0 End-State

A new MIH org admin can:
1. Connect a Meta Lead Ads page to MIH
2. Connect a Builtrix CRM org to MIH
3. See leads appear in MIH within 60 seconds of a form submission on Meta
4. See deduplication happening when the same phone submits again within 24h
5. Confirm the CRM received the lead (`crm_handoff_status='succeeded'`)
6. See CRM lifecycle events flow back (contacted, qualified, etc.)
7. View a basic dashboard with raw count, dedup count, source breakdown

---

## Directive Sequence (dependency-strict)

```
M-001 Multi-tenancy foundation
  └── BLOCKS: everything else

M-002 RBAC engine
  └── DEPENDS ON: M-001

M-003 Connector framework
  └── DEPENDS ON: M-001, M-002

M-004 Meta Lead Ads connector
  └── DEPENDS ON: M-003

M-005 Lead ingestion pipeline
  └── DEPENDS ON: M-003 (M-004 for full testing)

M-006 Identity graph + dedup engine
  └── DEPENDS ON: M-005

M-007 Unique leads projection
  └── DEPENDS ON: M-006

M-008 CRM handoff worker
  └── DEPENDS ON: M-007

M-009 CRM event inbox         ← can build in parallel with M-007
  └── DEPENDS ON: M-001, M-002

M-010 Basic dashboard
  └── DEPENDS ON: M-007, M-008, M-009

M-011 Admin UI: connect source
  └── DEPENDS ON: M-003, M-004

M-012 Admin UI: CRM connection
  └── DEPENDS ON: M-008, M-009
```

---

## V0 Acceptance Gate

All of the following must pass before V0 is called done:

```
[ ] M-001 cross-tenant test suite: 100% pass
[ ] M-002 RBAC: all 6 roles tested for correct allow/deny on all resources
[ ] End-to-end integration test:
    [ ] Provision MIH org linked to CRM org
    [ ] Connect Meta Lead Ads page to MIH
    [ ] Submit test lead via Meta Graph API sandbox
    [ ] MIH ingests within 60 sec
    [ ] Dedup: unique → raw_leads.dedup_status='unique'
    [ ] CRM POST succeeds → crm_handoff_status='succeeded'
    [ ] CRM returns 201 with lead_id
    [ ] Dashboard shows lead with correct status
    [ ] Submit same phone again within 24h
    [ ] Second lead → dedup_status='duplicate'
    [ ] CRM fires lead.contacted webhook → MIH receives + stores
    [ ] unique_leads.last_lifecycle_state='contacted'
[ ] No CRITICAL security findings (V5 Gate 4 scan)
[ ] Coverage: 80% lines, 90% branches on all M-001 through M-012 modules
```

---

## Directives

| Directive | Title | Effort |
|---|---|---|
| M-001 | Multi-tenancy foundation | 3 days |
| M-002 | RBAC engine | 2 days |
| M-003 | Connector framework | 3 days |
| M-004 | Meta Lead Ads connector | 5 days |
| M-005 | Lead ingestion pipeline | 2 days |
| M-006 | Identity graph + dedup engine | 3 days |
| M-007 | Unique leads projection | 2 days |
| M-008 | CRM handoff worker | 3 days |
| M-009 | CRM event inbox | 2 days |
| M-010 | Basic dashboard | 3 days |
| M-011 | Admin UI: connect source | 2 days |
| M-012 | Admin UI: CRM connection | 2 days |
| **Total** | | **~32 dev-days / ~6.5 weeks** |
