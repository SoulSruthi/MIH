# M-106 to M-114 · V1 Feature Directives

---

## M-106 · Dedup Rule Editor
**Depends on:** M-006 | **Effort:** 2 days

### In Scope
- `/admin/dedup-rules` page (mih_org_admin)
- Configure per org: phone_window_hours (1-720h), email_dedup_enabled, fuzzy_phone_enabled, post_window_behavior
- Preview: "With these rules, X% of last week's leads would have been deduplicated"
- Save → update dedup_rules row → audit_log

### Acceptance Criteria
```
[ ] Save changes → dedup_rules updated + audit_log
[ ] Preview dedup rate calculated correctly
[ ] Changing window from 24h to 48h → dedup engine respects new window immediately
[ ] Range validation: window_hours must be 1-720
```

---

## M-107 · Spend Tracking
**Depends on:** M-004 (Meta), M-101 (Google) | **Effort:** 4 days

### In Scope
- `spend_daily` table is already in schema (from V0)
- Inngest daily cron `spend.daily_sync` at 02:00 IST:
  - Meta: pull `act_{ad_account_id}/insights` for yesterday's spend per campaign
  - Google: pull campaign performance report for yesterday
- Manual entry UI: `/admin/spend` — enter spend per source per date for non-API sources (99acres, MagicBricks, etc.)
- CSV upload for historical spend import
- Spend completeness indicator: shows which sources have spend data for the selected period

### Acceptance Criteria
```
[ ] Meta daily spend syncs automatically; visible in dashboard by 06:00 IST
[ ] Manual spend entry: save → spend_daily row inserted
[ ] Corrections: new row with superseded_by pointer
[ ] spend_completeness indicator: 🟢 if all active sources have spend, 🟡 if partial, 🔴 if missing
```

---

## M-108 · Attribution Engine V1
**Depends on:** M-007, M-009, M-107 | **Effort:** 5 days

### Attribution model: last-touch (D-04 locked)

**Last-touch rule:** The source/campaign/ad that produced the `raw_lead` that became the `unique_lead` that eventually hit a lifecycle state (contacted/qualified/won) gets 100% credit for that outcome.

### In Scope
- `attribution/` module: pure function, no side effects
- Inngest `mih/crm.event_received` handler: recomputes attribution for the affected unique_lead's source chain
- Nightly full recompute: `attribution.rollup` cron at 04:00 IST (last 90 days)
- Computed metrics: CPL, CPA (cost per deal), ROAS (for deal.won with value)
- `model_version = 'last_touch_v1'` on all V1 rollup rows

### Acceptance Criteria
```
[ ] deal.won event → attribution_rollups row updated with final_value_inr → ROAS computed
[ ] lead.contacted → contacted_count incremented in rollup
[ ] Nightly recompute is idempotent: running twice produces same result
[ ] Attribution is pure: same inputs always produce same outputs (no side effects)
[ ] Rollups rebuild from scratch correctly after full delete
```

---

## M-109 · ROI Dashboards
**Depends on:** M-108 | **Effort:** 5 days

### Pages
- `/dashboard/roi` — main ROI page
- `/dashboard/roi/sources` — per-source drill-down
- `/dashboard/roi/campaigns` — per-campaign drill-down (meta, google)
- `/dashboard/roi/ads` — per-ad drill-down (V1 for Meta + Google)

### Widgets
- CPL (cost per lead) per source/campaign
- CPA (cost per acquired deal) per source
- ROAS (revenue / spend) per source
- Funnel: leads → contacted → qualified → site visit → deal → won
- Spend completeness indicator
- Period selector: day / week / month / custom range
- Source comparison chart (multi-bar)

### Acceptance Criteria
```
[ ] CPL = (spend_inr / unique_lead_count) computed correctly
[ ] Zero-spend sources show CPL = null (not zero) with indicator
[ ] Funnel visualization correct for all conversion stages
[ ] < 500ms load time for 6 sources × 90 days of data
```

---

## M-110 · Lead Detail Panel
**Depends on:** M-007, M-008, M-009 | **Effort:** 3 days

### Page: `/leads/{unique_lead_id}`

Full timeline for one person:
- All raw_leads that merged into this unique_lead (source, timestamp, campaign)
- CRM lifecycle events timeline (contacted, qualified, etc.)
- CRM handoff status + link to CRM lead
- MIH enrichment (intent score, quality grade — shown as N/A in V0/V1)

### Permission
- mih_org_admin, marketing_analyst, marketing_ops: full detail
- marketing_manager: aggregate only (no phone/email)
- org_viewer: no lead detail access

---

## M-111 · User Management UI
**Depends on:** M-002 | **Effort:** 2 days

### Page: `/admin/users`
- List of org members with role badges
- Invite user: email + role assignment → Supabase Auth invite email
- Change role: dropdown
- Remove user: confirmation dialog + audit_log
- **Permission:** `user:invite:org` (mih_org_admin only)

---

## M-112 · Anomaly Alerts V1
**Depends on:** M-109 | **Effort:** 3 days

### Alert types
- **CPL spike:** week-over-week CPL increase > 50% for any source → email to mih_org_admin
- **Source health drop:** health_score < 50 for any active source → email
- **Zero leads in 24h** from any previously-active source → email

### Implementation
- Inngest cron `anomaly.check` daily at 07:00 IST
- Resend for email delivery
- Per-org alert preferences (enable/disable per type)

---

## M-113 · DLQ Management UI
**Depends on:** M-003 | **Effort:** 2 days

### Page: `/sources/dlq`
- Table of `connector_dlq` rows: source, failure_stage, error_message, retry_count
- Filter by source, failure_stage, status
- **Replay individual:** re-runs normalization + ingestion for one row
- **Replay batch:** replay all `failed` rows for a source
- **Mark ignored:** remove from active DLQ view

### Permission
- marketing_ops: full DLQ access + replay
- mih_org_admin: view + replay

---

## M-114 · Billing Integration
**Depends on:** M-001 | **Effort:** 3 days

### Pricing model (V1)
- Per-seat: ₹X/month per active membership
- Per-lead-handed-off: ₹Y per unique_lead with crm_handoff_status='succeeded'
- Free tier: first 200 leads/month, up to 3 seats

### In Scope
- Stripe Checkout for subscription creation
- Stripe webhook: `customer.subscription.updated`, `invoice.payment_succeeded`, `invoice.payment_failed`
- Grace period: 7 days on payment failure before suspension
- Auto-suspend: `organizations.status='suspended'` after grace expires
- Billing page: `/admin/billing` — plan, usage, invoices, upgrade CTA

### Env Vars
```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRODUCT_ID_PER_SEAT
STRIPE_PRODUCT_ID_PER_LEAD
```
