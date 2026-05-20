-- Migration 009: Spend Attribution
-- Creates spend_daily, attribution_rollups, crm_lifecycle_events tables
-- and adds missing columns to dedup_rules.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. spend_daily
-- Tracks daily spend per source/campaign.
-- Supports API-pulled (meta, google) and manually-entered spend.
-- Amounts in paise (1/100 INR).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS spend_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  spend_date date NOT NULL,
  amount_paise bigint NOT NULL DEFAULT 0, -- 1/100 INR
  currency text NOT NULL DEFAULT 'INR',
  campaign_id text, -- vendor campaign ID (for API-sourced spend)
  campaign_name text,
  data_source text NOT NULL DEFAULT 'manual' CHECK (data_source IN ('api', 'manual', 'csv')),
  superseded_by uuid REFERENCES spend_daily(id), -- for corrections
  entered_by uuid REFERENCES auth.users(id),
  raw_payload jsonb, -- original API response if data_source='api'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Uniqueness for source-level (no campaign) spend rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_spend_daily_source_date_null_campaign
  ON spend_daily(organization_id, source_id, spend_date)
  WHERE campaign_id IS NULL;

-- Uniqueness for campaign-level spend rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_spend_daily_source_date_campaign
  ON spend_daily(organization_id, source_id, spend_date, campaign_id)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_spend_daily_org_source ON spend_daily(organization_id, source_id);
CREATE INDEX IF NOT EXISTS idx_spend_daily_date ON spend_daily(organization_id, spend_date);

ALTER TABLE spend_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spend_daily_org_isolation" ON spend_daily
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());

-- ---------------------------------------------------------------------------
-- 2. attribution_rollups
-- Computed daily rollup of attribution metrics per source.
-- Rebuilt nightly by Inngest.
-- Amounts in paise (1/100 INR).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS attribution_rollups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  rollup_date date NOT NULL,
  model_version text NOT NULL DEFAULT 'last_touch_v1',
  -- Funnel counts
  unique_lead_count integer NOT NULL DEFAULT 0,
  contacted_count integer NOT NULL DEFAULT 0,
  qualified_count integer NOT NULL DEFAULT 0,
  site_visit_count integer NOT NULL DEFAULT 0,
  deal_count integer NOT NULL DEFAULT 0,
  won_count integer NOT NULL DEFAULT 0,
  -- Revenue
  won_value_paise bigint NOT NULL DEFAULT 0,
  -- Spend (copied from spend_daily for this source+date)
  spend_paise bigint NOT NULL DEFAULT 0,
  -- Computed metrics (stored for fast queries)
  cpl_paise bigint, -- cost per lead = spend / unique_lead_count (NULL if no leads or no spend)
  cpa_paise bigint, -- cost per deal = spend / deal_count
  roas_times_100 integer, -- ROAS * 100 (e.g. 250 means 2.5x)
  -- Metadata
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, source_id, rollup_date, model_version)
);

CREATE INDEX IF NOT EXISTS idx_attribution_rollups_org ON attribution_rollups(organization_id);
CREATE INDEX IF NOT EXISTS idx_attribution_rollups_date ON attribution_rollups(organization_id, rollup_date);
CREATE INDEX IF NOT EXISTS idx_attribution_rollups_source ON attribution_rollups(organization_id, source_id);

ALTER TABLE attribution_rollups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attribution_rollups_org_isolation" ON attribution_rollups
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());

-- ---------------------------------------------------------------------------
-- 3. dedup_rules — add missing columns (table created in migration 006)
-- ---------------------------------------------------------------------------

ALTER TABLE dedup_rules ADD COLUMN IF NOT EXISTS email_dedup_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE dedup_rules ADD COLUMN IF NOT EXISTS fuzzy_phone_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE dedup_rules ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- 4. crm_lifecycle_events
-- Tracks CRM lifecycle events that drive attribution.
-- Amounts in paise (1/100 INR).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  unique_lead_id uuid NOT NULL REFERENCES unique_leads(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('contacted', 'qualified', 'site_visit', 'deal', 'won', 'lost', 'dropped')),
  event_at timestamptz NOT NULL DEFAULT now(),
  deal_value_paise bigint, -- for 'won' events; 1/100 INR
  crm_external_id text, -- CRM system's ID for this event
  source_id uuid REFERENCES sources(id), -- attributed source at time of event
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_lifecycle_events_org ON crm_lifecycle_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_lifecycle_events_lead ON crm_lifecycle_events(unique_lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_lifecycle_events_type ON crm_lifecycle_events(organization_id, event_type);

ALTER TABLE crm_lifecycle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_lifecycle_events_org_isolation" ON crm_lifecycle_events
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());

COMMIT;

-- ---------------------------------------------------------------------------
-- ROLLBACK (run manually if this migration needs to be reversed)
-- ---------------------------------------------------------------------------
-- BEGIN;
--
-- DROP POLICY IF EXISTS "crm_lifecycle_events_org_isolation" ON crm_lifecycle_events;
-- DROP TABLE IF EXISTS crm_lifecycle_events;
--
-- ALTER TABLE dedup_rules DROP COLUMN IF EXISTS updated_at;
-- ALTER TABLE dedup_rules DROP COLUMN IF EXISTS fuzzy_phone_enabled;
-- ALTER TABLE dedup_rules DROP COLUMN IF EXISTS email_dedup_enabled;
--
-- DROP POLICY IF EXISTS "attribution_rollups_org_isolation" ON attribution_rollups;
-- DROP TABLE IF EXISTS attribution_rollups;
--
-- DROP POLICY IF EXISTS "spend_daily_org_isolation" ON spend_daily;
-- DROP INDEX IF EXISTS idx_spend_daily_source_date_null_campaign;
-- DROP INDEX IF EXISTS idx_spend_daily_source_date_campaign;
-- DROP TABLE IF EXISTS spend_daily;
--
-- COMMIT;
