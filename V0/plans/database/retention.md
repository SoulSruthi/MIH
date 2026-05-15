# Data Retention Policy

---

## Principles

1. **Substrate is permanent** — `raw_leads`, `crm_lifecycle_events`, `audit_log` are never deleted
2. **Projections are rebuildable** — `attribution_rollups`, `cohort_snapshots` can be deleted and recomputed
3. **PII follows consent** — on account deletion, PII is zeroed out; lead records remain for audit integrity
4. **AI artifacts are capped** — `agent_actions` retain for 12 months then purged; `diagnostic_sessions` expire in 7 days

---

## Retention Table

| Table | Retention | Deletion Method | Notes |
|---|---|---|---|
| `raw_leads` | Permanent | Never deleted | Immutable substrate |
| `unique_leads` | Permanent | PII zeroed on org deletion | Lead ID preserved for audit |
| `crm_lifecycle_events` | Permanent | Never deleted | Audit substrate |
| `audit_log` | Permanent | Never deleted | Legal requirement |
| `attribution_rollups` | 2 years rolling | Cron deletes rows >2 years old | Rebuildable from substrate |
| `spend_daily` | 2 years rolling | Cron deletes rows >2 years old | Superseded rows kept 90 days |
| `cohort_snapshots` | 2 years rolling | Cron deletes rows >2 years old | Rebuildable |
| `agent_actions` | 12 months | Cron deletes rows >12 months old | LLM cost/output audit |
| `diagnostic_sessions` | 7 days | Cron deletes expired sessions | `expires_at` column |
| `pending_creative_actions` | 90 days after status=final | Cron deletes resolved rows | |
| `budget_recommendations` | 12 months | Cron deletes rows >12 months old | |
| `connector_dlq` | 90 days after resolution | Cron deletes resolved + ignored | |
| `sessions` (Supabase Auth) | Managed by Supabase | — | Not our table |

---

## PII Zeroing on Org Deletion

When an org is deleted (hard delete):
1. `organizations.status = 'deleted'` + soft delete timestamp
2. 30-day grace period (accidental deletion protection)
3. After 30 days: PII zeroing job runs
   - `raw_leads`: zero `name`, `phone_e164`, `phone_e164_hash`, `email`, `raw_payload`
   - `unique_leads`: zero `canonical_name`, `canonical_phone`, `canonical_email`
   - `crm_lifecycle_events`: zero `contact_name`, `contact_email` (if present)
   - All records remain (IDs, timestamps, source_ids, org_id preserved for referential integrity)
4. `credentials` table rows: hard deleted immediately on grace period expiry
5. `audit_log`: zeroed of actor PII; action records preserved

---

## Retention Cron Jobs

All retention jobs run as Inngest cron at 03:00 IST (low-traffic window):

```
retention.rollups.cleanup     — delete attribution_rollups older than 2 years
retention.cohorts.cleanup     — delete cohort_snapshots older than 2 years  
retention.spend.cleanup       — delete spend_daily older than 2 years
retention.agent_actions.cleanup — delete agent_actions older than 12 months
retention.sessions.cleanup    — delete diagnostic_sessions past expires_at
retention.dlq.cleanup         — delete resolved connector_dlq rows older than 90 days
retention.org_deletion.pii    — process orgs in grace period; zero PII after 30 days
```

All retention jobs log to `audit_log` with `action_type = 'retention_purge'` and `rows_affected` count.

---

## Compliance Notes

- **DPDPA (India):** Personal data must be erasable on request. PII zeroing satisfies this.
- **RERA:** Lead records for real estate transactions may need to be preserved. The non-PII record (IDs, timestamps, attribution) is always preserved.
- **Audit trail:** All retention actions logged; audit_log itself is never purged.
- **Backup:** Supabase daily backups retained for 7 days (paid plan). Point-in-time recovery available.
