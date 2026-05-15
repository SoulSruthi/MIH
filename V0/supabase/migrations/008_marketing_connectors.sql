-- =================================================================
-- Migration: 008_marketing_connectors
-- Strategy: ADDITIVE ONLY — no renames, no drops
-- Tables: source_categories, connector_definitions,
--         org_connector_configs, source_costs
-- Alters:  sources (4 nullable columns added)
-- =================================================================

BEGIN;

-- -----------------------------------------------------------------
-- 1. source_categories
--    NULL organization_id = system-defined row (visible to all orgs)
--    Non-NULL = custom row owned by that org
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS source_categories (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category        text        NOT NULL
                                CHECK (category IN ('ATL', 'BTL', 'Digital', 'Niche')),
  name            text        NOT NULL,
  description     text,
  is_custom       boolean     NOT NULL DEFAULT false,
  organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_categories_org
  ON source_categories(organization_id);

ALTER TABLE source_categories ENABLE ROW LEVEL SECURITY;

-- SELECT: own org rows + system rows (organization_id IS NULL)
CREATE POLICY "source_categories_read" ON source_categories
  FOR SELECT USING (organization_id IS NULL OR organization_id = public.app_org_id());

-- INSERT / UPDATE / DELETE: only own org's custom rows
CREATE POLICY "source_categories_write" ON source_categories
  FOR ALL USING (organization_id = public.app_org_id());

-- -----------------------------------------------------------------
-- 2. connector_definitions
--    System-level catalogue; read-only for org users.
--    source_category_id FK added after source_categories is seeded.
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS connector_definitions (
  id                      text        PRIMARY KEY,
  display_name            text        NOT NULL,
  source_category_id      uuid        REFERENCES source_categories(id),
  auth_kind               text        NOT NULL
                                        CHECK (auth_kind IN (
                                          'oauth2', 'api_key',
                                          'bearer_token', 'basic', 'none'
                                        )),
  credential_schema       jsonb       NOT NULL DEFAULT '[]',
  supports_auto_fetch     boolean     NOT NULL DEFAULT false,
  supports_spend_tracking boolean     NOT NULL DEFAULT true,
  vendor_docs_url         text,
  is_active               boolean     NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE connector_definitions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read connector definitions
CREATE POLICY "connector_definitions_read_all" ON connector_definitions
  FOR SELECT USING (true);

-- -----------------------------------------------------------------
-- 3. org_connector_configs
--    One row per (org, connector) enabled connector instance.
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_connector_configs (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connector_id         text        NOT NULL REFERENCES connector_definitions(id),
  is_enabled           boolean     NOT NULL DEFAULT true,
  credentials_encrypted text,                        -- AES-256-GCM encrypted JSON
  config               jsonb       NOT NULL DEFAULT '{}',
  last_synced_at       timestamptz,
  last_sync_error      text,
  health_score         integer     CHECK (health_score BETWEEN 0 AND 100),
  created_by           uuid        REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, connector_id)
);

CREATE INDEX IF NOT EXISTS idx_org_connector_configs_org
  ON org_connector_configs(organization_id);

ALTER TABLE org_connector_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_connector_configs_org_isolation" ON org_connector_configs
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());

-- -----------------------------------------------------------------
-- 4. source_costs
--    Cost tracking per source per period (stored in paise).
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS source_costs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id       uuid        NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  period_start    date        NOT NULL,
  period_end      date        NOT NULL,
  amount_paise    bigint      NOT NULL DEFAULT 0,
  currency        text        NOT NULL DEFAULT 'INR',
  notes           text,
  entered_by      uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_source_costs_org_source
  ON source_costs(organization_id, source_id);

ALTER TABLE source_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "source_costs_org_isolation" ON source_costs
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());

-- -----------------------------------------------------------------
-- 5. Extend sources table (additive nullable columns)
-- -----------------------------------------------------------------
ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS source_category_id    uuid    REFERENCES source_categories(id),
  ADD COLUMN IF NOT EXISTS connector_id          text    REFERENCES connector_definitions(id),
  ADD COLUMN IF NOT EXISTS is_enabled            boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cost_tracking_enabled boolean NOT NULL DEFAULT false;

-- -----------------------------------------------------------------
-- 6. Seed: source_categories (system-wide; organization_id = NULL)
-- -----------------------------------------------------------------
INSERT INTO source_categories (category, name, description, is_custom) VALUES
  -- ATL
  ('ATL', 'TV Advertisement',    'Television commercials and sponsorships',        false),
  ('ATL', 'Radio',               'Radio ads and jingles',                          false),
  ('ATL', 'Newspaper',           'Print newspaper ads',                            false),
  ('ATL', 'Magazine',            'Magazine ads',                                   false),
  ('ATL', 'Billboard / OOH',     'Out-of-home and billboard advertising',          false),
  ('ATL', 'Cinema',              'Cinema pre-roll and screen ads',                 false),
  -- BTL
  ('BTL', 'Direct Mail',         'Physical mailers, brochures, flyers',            false),
  ('BTL', 'SMS Campaign',        'Bulk SMS marketing',                             false),
  ('BTL', 'Email Campaign',      'Email marketing blasts',                         false),
  ('BTL', 'Events & Exhibitions','Property expos, site visits, events',            false),
  ('BTL', 'Sponsorship',         'Event and community sponsorships',               false),
  ('BTL', 'PR / Press Release',  'Media coverage and PR',                          false),
  ('BTL', 'Referral Program',    'Existing customer referrals',                    false),
  ('BTL', 'Loyalty Program',     'Customer retention programs',                    false),
  ('BTL', 'Cold Calling',        'Outbound telephone campaigns',                   false),
  ('BTL', 'Walk-in / Site Visit','In-person walk-ins at the project site',         false),
  -- Digital
  ('Digital', 'Google Ads',          'Google Search and Display advertising',      false),
  ('Digital', 'Facebook Ads',        'Facebook and Instagram paid ads',            false),
  ('Digital', 'Instagram Organic',   'Organic Instagram posts and reels',          false),
  ('Digital', 'LinkedIn Ads',        'LinkedIn paid advertising',                  false),
  ('Digital', 'YouTube Ads',         'YouTube video advertising',                  false),
  ('Digital', 'SEO / Organic Search','Search engine optimization traffic',         false),
  ('Digital', 'SEM',                 'Search engine marketing (paid)',              false),
  ('Digital', 'Display Ads',         'Banner and display network ads',             false),
  ('Digital', 'Programmatic',        'Programmatic ad buying',                     false),
  ('Digital', 'WhatsApp Campaign',   'WhatsApp Business messaging',                false),
  ('Digital', 'Affiliate Marketing', 'Affiliate and partner networks',             false),
  ('Digital', 'Content Marketing',   'Blog, video, and content-driven leads',      false),
  ('Digital', 'Influencer Marketing','Social media influencer campaigns',           false),
  ('Digital', 'Retargeting',         'Pixel and retargeting campaigns',            false),
  -- Niche / Real Estate Portals
  ('Niche', '99acres',             '99acres real estate portal',   false),
  ('Niche', 'MagicBricks',         'MagicBricks real estate portal',false),
  ('Niche', 'Housing.com',         'Housing.com real estate portal',false),
  ('Niche', 'NoBroker',            'NoBroker platform',            false),
  ('Niche', 'Sulekha',             'Sulekha lead platform',        false),
  ('Niche', 'JustDial',            'JustDial local search',        false),
  ('Niche', 'CommonFloor',         'CommonFloor portal',           false),
  ('Niche', 'PropTiger',           'PropTiger portal',             false),
  ('Niche', 'Makaan.com',          'Makaan real estate portal',    false),
  ('Niche', 'IndiaProperty',       'IndiaProperty portal',         false),
  ('Niche', 'Manual Entry',        'Manually entered leads',       false),
  ('Niche', 'Phone Inquiry',       'Inbound phone calls',          false),
  ('Niche', 'Reference / Broker',  'Broker and reference leads',   false)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------
-- 7. Seed: connector_definitions
--    source_category_id resolved via subquery after seed above.
-- -----------------------------------------------------------------
INSERT INTO connector_definitions (
  id, display_name, auth_kind,
  supports_auto_fetch, supports_spend_tracking,
  vendor_docs_url, credential_schema
) VALUES
  (
    'google_ads', 'Google Ads', 'oauth2', true, true,
    'https://developers.google.com/google-ads/api/docs/start',
    '[{"field":"customer_id","label":"Customer ID","type":"text","required":true},{"field":"developer_token","label":"Developer Token","type":"password","required":true}]'
  ),
  (
    'facebook_ads', 'Facebook / Meta Ads', 'oauth2', true, true,
    'https://developers.facebook.com/docs/marketing-api',
    '[{"field":"ad_account_id","label":"Ad Account ID","type":"text","required":true}]'
  ),
  (
    '99acres', '99acres', 'api_key', true, false,
    'https://www.99acres.com/',
    '[{"field":"api_key","label":"API Key","type":"password","required":true},{"field":"project_id","label":"Project ID","type":"text","required":true}]'
  ),
  (
    'magicbricks', 'MagicBricks', 'api_key', true, false,
    'https://www.magicbricks.com/',
    '[{"field":"api_key","label":"API Key","type":"password","required":true},{"field":"project_id","label":"Project ID","type":"text","required":true}]'
  ),
  (
    'housing_com', 'Housing.com', 'api_key', true, false,
    'https://housing.com/',
    '[{"field":"api_key","label":"API Key","type":"password","required":true},{"field":"project_id","label":"Project ID","type":"text","required":true}]'
  ),
  (
    'manual', 'Manual Entry', 'none', false, true,
    NULL,
    '[]'
  )
ON CONFLICT (id) DO NOTHING;

-- Link connector_definitions → source_categories
-- Guarded with WHERE source_category_id IS NULL so re-runs are safe.
UPDATE connector_definitions SET source_category_id = (
  SELECT id FROM source_categories WHERE name = 'Google Ads' AND organization_id IS NULL LIMIT 1
) WHERE id = 'google_ads' AND source_category_id IS NULL;

UPDATE connector_definitions SET source_category_id = (
  SELECT id FROM source_categories WHERE name = 'Facebook Ads' AND organization_id IS NULL LIMIT 1
) WHERE id = 'facebook_ads' AND source_category_id IS NULL;

UPDATE connector_definitions SET source_category_id = (
  SELECT id FROM source_categories WHERE name = '99acres' AND organization_id IS NULL LIMIT 1
) WHERE id = '99acres' AND source_category_id IS NULL;

UPDATE connector_definitions SET source_category_id = (
  SELECT id FROM source_categories WHERE name = 'MagicBricks' AND organization_id IS NULL LIMIT 1
) WHERE id = 'magicbricks' AND source_category_id IS NULL;

UPDATE connector_definitions SET source_category_id = (
  SELECT id FROM source_categories WHERE name = 'Housing.com' AND organization_id IS NULL LIMIT 1
) WHERE id = 'housing_com' AND source_category_id IS NULL;

UPDATE connector_definitions SET source_category_id = (
  SELECT id FROM source_categories WHERE name = 'Manual Entry' AND organization_id IS NULL LIMIT 1
) WHERE id = 'manual' AND source_category_id IS NULL;

COMMIT;

-- =================================================================
-- rollback:
-- BEGIN;
-- ALTER TABLE sources
--   DROP COLUMN IF EXISTS cost_tracking_enabled,
--   DROP COLUMN IF EXISTS is_enabled,
--   DROP COLUMN IF EXISTS connector_id,
--   DROP COLUMN IF EXISTS source_category_id;
-- DROP TABLE IF EXISTS source_costs;
-- DROP TABLE IF EXISTS org_connector_configs;
-- DROP TABLE IF EXISTS connector_definitions;
-- DROP TABLE IF EXISTS source_categories;
-- COMMIT;
-- =================================================================
