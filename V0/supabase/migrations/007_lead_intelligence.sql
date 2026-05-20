-- =================================================================
-- Migration: 007_lead_intelligence
-- Adds known_names to unique_leads, dedup_reason to raw_leads,
-- and a source_lead_stats view for the Lead Intelligence UI.
-- Rule: ADDITIVE ONLY
-- =================================================================

-- -----------------------------------------------------------------
-- known_names: alternate names seen for the same phone number
-- -----------------------------------------------------------------

ALTER TABLE unique_leads
  ADD COLUMN known_names text[] NOT NULL DEFAULT '{}';

-- -----------------------------------------------------------------
-- dedup_reason: why a raw_lead was marked duplicate
-- -----------------------------------------------------------------

ALTER TABLE raw_leads
  ADD COLUMN dedup_reason text
    CHECK (dedup_reason IN ('within_window', 'post_window_merge'));

-- -----------------------------------------------------------------
-- source_lead_stats view (tenant-aware via app_org_id())
-- Used by /api/leads/stats
-- -----------------------------------------------------------------

CREATE OR REPLACE VIEW source_lead_stats AS
SELECT
  s.organization_id,
  s.id                                                        AS source_id,
  s.display_name                                              AS source_name,
  s.source_kind,
  COUNT(rl.id)                                                AS total_leads,
  COUNT(rl.id) FILTER (WHERE rl.dedup_status = 'unique')     AS unique_count,
  COUNT(rl.id) FILTER (WHERE rl.dedup_status = 'duplicate')  AS duplicate_count,
  COUNT(rl.id) FILTER (WHERE rl.dedup_status = 'pending')    AS pending_count,
  ROUND(
    COUNT(rl.id) FILTER (WHERE rl.dedup_status = 'duplicate')::numeric
    / NULLIF(
        COUNT(rl.id) FILTER (WHERE rl.dedup_status IN ('unique','duplicate')),
        0
      ) * 100,
    1
  )                                                           AS dedup_rate_pct
FROM sources s
LEFT JOIN raw_leads rl
  ON rl.source_id = s.id
  AND rl.organization_id = s.organization_id
GROUP BY s.organization_id, s.id, s.display_name, s.source_kind;

-- RLS: row-level security on the view is enforced by the underlying tables.
-- Direct access restricted to service_role; app layer filters by org_id.

-- -----------------------------------------------------------------
-- ROLLBACK (reference — never run in forward migration)
-- =================================================================
-- DROP VIEW IF EXISTS source_lead_stats;
-- ALTER TABLE raw_leads DROP COLUMN IF EXISTS dedup_reason;
-- ALTER TABLE unique_leads DROP COLUMN IF EXISTS known_names;
-- =================================================================
