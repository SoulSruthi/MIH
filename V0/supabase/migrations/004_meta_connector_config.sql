-- =================================================================
-- Migration: 004_meta_connector_config
-- Directive: M-004 Meta Lead Ads Connector
-- Rule: ADDITIVE ONLY
-- =================================================================

-- Index for fast webhook lookup: "does this leadgen_id already exist?"
-- source_external_id is already UNIQUE per (source_id) in raw_leads (M-005),
-- but we need a fast read-path before raw_leads exists. This migration
-- adds a partial index on sources for Meta to support the idempotency check.

-- No new tables required: sources + credentials + connector_dlq already exist.
-- Config shape for meta_lead_ads sources (documented here; enforced in app layer):
--   config: {
--     page_id:         text      -- required
--     ad_account_id:   text      -- required for spend sync (format: act_<id>)
--     form_ids:        text[]    -- optional allowlist; empty = all forms
--     token_expires_at: timestamptz  -- tracked for proactive refresh
--   }

-- Partial index: look up active Meta sources fast (used by poller + webhook dispatcher)
CREATE INDEX IF NOT EXISTS sources_meta_active_idx
  ON sources(organization_id, id)
  WHERE source_kind = 'meta_lead_ads' AND state IN ('authorized', 'active');
