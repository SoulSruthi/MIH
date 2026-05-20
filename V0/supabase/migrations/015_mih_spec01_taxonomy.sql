-- =================================================================
-- Migration: 015_mih_spec01_taxonomy
-- Purpose: Source & Channel Taxonomy (Spec 01 V0)
-- Rule: ADDITIVE ONLY — never modify existing tables
-- =================================================================

-- -----------------------------------------------------------------
-- mih.sources — 7-level hierarchy using LTREE
-- -----------------------------------------------------------------
CREATE TABLE mih.sources (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_id                 uuid REFERENCES mih.sources(id),
  level                     text NOT NULL CHECK (level IN ('channel','medium','source','sub_source')),
  code                      text NOT NULL,
  display_name              text NOT NULL,
  taxonomy_path             ltree NOT NULL,
  attributes                jsonb NOT NULL DEFAULT '{}',
  is_platform_managed       boolean NOT NULL DEFAULT false,
  lifecycle_state           text NOT NULL DEFAULT 'active'
                              CHECK (lifecycle_state IN ('active','launch_only','paused','killed')),
  launch_only_for_project_ids uuid[] NOT NULL DEFAULT '{}',
  created_at                timestamptz NOT NULL DEFAULT now(),
  created_by                uuid,
  UNIQUE (org_id, taxonomy_path)
);

CREATE INDEX mih_sources_taxonomy_path_gist ON mih.sources USING gist(taxonomy_path);
CREATE INDEX mih_sources_org_id_idx ON mih.sources(org_id);
CREATE INDEX mih_sources_parent_id_idx ON mih.sources(parent_id);

ALTER TABLE mih.sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_sources_tenant_isolation ON mih.sources
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_sources_service_write ON mih.sources
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Immutability guard: code is immutable after creation
CREATE OR REPLACE FUNCTION mih.sources_code_immutability_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'mih.sources.code is immutable after creation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mih_sources_code_immutable
  BEFORE UPDATE ON mih.sources
  FOR EACH ROW EXECUTE FUNCTION mih.sources_code_immutability_guard();

-- -----------------------------------------------------------------
-- mih.activities — BTL activities
-- -----------------------------------------------------------------
CREATE TABLE mih.activities (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_id         uuid REFERENCES mih.sources(id),
  project_id        uuid,
  activity_code     text NOT NULL,
  display_name      text NOT NULL,
  activity_type     text NOT NULL
                      CHECK (activity_type IN (
                        'hoarding','btl_mall','btl_apartment','flyer','event','signage',
                        'noparking','tv','newspaper','theatre','influencer','postal',
                        'portal_listing'
                      )),
  location          text,
  start_date        date,
  end_date          date,
  lifecycle_state   text NOT NULL DEFAULT 'active',
  metadata          jsonb NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, activity_code)
);

CREATE INDEX mih_activities_org_id_idx ON mih.activities(org_id);
CREATE INDEX mih_activities_source_id_idx ON mih.activities(source_id);
CREATE INDEX mih_activities_project_id_idx ON mih.activities(project_id);

ALTER TABLE mih.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_activities_tenant_isolation ON mih.activities
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_activities_service_write ON mih.activities
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- Seed function: insert platform-managed sources for an org
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION mih.seed_platform_sources(p_org_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  -- Channel IDs
  ch_online       uuid := gen_random_uuid();
  ch_offline      uuid := gen_random_uuid();
  ch_cp           uuid := gen_random_uuid();
  ch_referral     uuid := gen_random_uuid();
  -- Online medium IDs
  med_paid_social uuid := gen_random_uuid();
  med_paid_search uuid := gen_random_uuid();
  med_portals     uuid := gen_random_uuid();
  med_owned_web   uuid := gen_random_uuid();
  med_messaging   uuid := gen_random_uuid();
  -- Offline medium IDs
  med_btl         uuid := gen_random_uuid();
  med_branding    uuid := gen_random_uuid();
  med_walk_in     uuid := gen_random_uuid();
BEGIN
  -- Insert channels
  INSERT INTO mih.sources (id, org_id, parent_id, level, code, display_name, taxonomy_path, is_platform_managed)
  VALUES
    (ch_online,   p_org_id, NULL, 'channel', 'online',   'Online',   'online',   true),
    (ch_offline,  p_org_id, NULL, 'channel', 'offline',  'Offline',  'offline',  true),
    (ch_cp,       p_org_id, NULL, 'channel', 'cp',       'Channel Partners', 'cp', true),
    (ch_referral, p_org_id, NULL, 'channel', 'referral', 'Referral', 'referral', true)
  ON CONFLICT (org_id, taxonomy_path) DO NOTHING;

  -- Online mediums
  INSERT INTO mih.sources (id, org_id, parent_id, level, code, display_name, taxonomy_path, is_platform_managed)
  VALUES
    (med_paid_social, p_org_id, ch_online, 'medium', 'paid_social', 'Paid Social',    'online.paid_social', true),
    (med_paid_search, p_org_id, ch_online, 'medium', 'paid_search', 'Paid Search',    'online.paid_search', true),
    (med_portals,     p_org_id, ch_online, 'medium', 'portals',     'Property Portals','online.portals',    true),
    (med_owned_web,   p_org_id, ch_online, 'medium', 'owned_web',   'Owned Web',      'online.owned_web',   true),
    (med_messaging,   p_org_id, ch_online, 'medium', 'messaging',   'Messaging',      'online.messaging',   true)
  ON CONFLICT (org_id, taxonomy_path) DO NOTHING;

  -- Offline mediums
  INSERT INTO mih.sources (id, org_id, parent_id, level, code, display_name, taxonomy_path, is_platform_managed)
  VALUES
    (med_btl,      p_org_id, ch_offline, 'medium', 'btl',      'BTL',      'offline.btl',      true),
    (med_branding, p_org_id, ch_offline, 'medium', 'branding', 'Branding', 'offline.branding', true),
    (med_walk_in,  p_org_id, ch_offline, 'medium', 'walk_in',  'Walk-In',  'offline.walk_in',  true)
  ON CONFLICT (org_id, taxonomy_path) DO NOTHING;

  -- Online sources: paid_social
  INSERT INTO mih.sources (org_id, parent_id, level, code, display_name, taxonomy_path, is_platform_managed)
  VALUES
    (p_org_id, med_paid_social, 'source', 'meta_lead_ads', 'Meta Lead Ads',    'online.paid_social.meta_lead_ads', true)
  ON CONFLICT (org_id, taxonomy_path) DO NOTHING;

  -- Online sources: paid_search
  INSERT INTO mih.sources (org_id, parent_id, level, code, display_name, taxonomy_path, is_platform_managed)
  VALUES
    (p_org_id, med_paid_search, 'source', 'google_ads',    'Google Ads',       'online.paid_search.google_ads',    true)
  ON CONFLICT (org_id, taxonomy_path) DO NOTHING;

  -- Online sources: portals
  INSERT INTO mih.sources (org_id, parent_id, level, code, display_name, taxonomy_path, is_platform_managed)
  VALUES
    (p_org_id, med_portals, 'source', '99acres',       '99acres',          'online.portals.99acres',           true),
    (p_org_id, med_portals, 'source', 'magicbricks',   'MagicBricks',      'online.portals.magicbricks',       true),
    (p_org_id, med_portals, 'source', 'housing_com',   'Housing.com',      'online.portals.housing_com',       true),
    (p_org_id, med_portals, 'source', 'nobroker',      'NoBroker',         'online.portals.nobroker',          true),
    (p_org_id, med_portals, 'source', 'roof_and_floor','Roof and Floor',   'online.portals.roof_and_floor',    true),
    (p_org_id, med_portals, 'source', 'common_floor',  'CommonFloor',      'online.portals.common_floor',      true)
  ON CONFLICT (org_id, taxonomy_path) DO NOTHING;

  -- Online sources: owned_web
  INSERT INTO mih.sources (org_id, parent_id, level, code, display_name, taxonomy_path, is_platform_managed)
  VALUES
    (p_org_id, med_owned_web, 'source', 'website_form', 'Website Form',     'online.owned_web.website_form',    true)
  ON CONFLICT (org_id, taxonomy_path) DO NOTHING;

  -- Online sources: messaging
  INSERT INTO mih.sources (org_id, parent_id, level, code, display_name, taxonomy_path, is_platform_managed)
  VALUES
    (p_org_id, med_messaging, 'source', 'whatsapp_inbound', 'WhatsApp Inbound', 'online.messaging.whatsapp_inbound', true)
  ON CONFLICT (org_id, taxonomy_path) DO NOTHING;

  -- Offline sources: btl
  INSERT INTO mih.sources (org_id, parent_id, level, code, display_name, taxonomy_path, is_platform_managed)
  VALUES
    (p_org_id, med_btl, 'source', 'hoarding',             'Hoarding',             'offline.btl.hoarding',             true),
    (p_org_id, med_btl, 'source', 'mall_activation',      'Mall Activation',      'offline.btl.mall_activation',      true),
    (p_org_id, med_btl, 'source', 'apartment_activation', 'Apartment Activation', 'offline.btl.apartment_activation', true),
    (p_org_id, med_btl, 'source', 'flyer',                'Flyer',                'offline.btl.flyer',                true),
    (p_org_id, med_btl, 'source', 'event',                'Event',                'offline.btl.event',                true)
  ON CONFLICT (org_id, taxonomy_path) DO NOTHING;

  -- Offline sources: branding
  INSERT INTO mih.sources (org_id, parent_id, level, code, display_name, taxonomy_path, is_platform_managed)
  VALUES
    (p_org_id, med_branding, 'source', 'tv_ad',       'TV Ad',       'offline.branding.tv_ad',       true),
    (p_org_id, med_branding, 'source', 'newspaper_ad','Newspaper Ad','offline.branding.newspaper_ad', true),
    (p_org_id, med_branding, 'source', 'theatre_ad',  'Theatre Ad',  'offline.branding.theatre_ad',   true),
    (p_org_id, med_branding, 'source', 'influencer',  'Influencer',  'offline.branding.influencer',   true)
  ON CONFLICT (org_id, taxonomy_path) DO NOTHING;

  -- Offline sources: walk_in
  INSERT INTO mih.sources (org_id, parent_id, level, code, display_name, taxonomy_path, is_platform_managed)
  VALUES
    (p_org_id, med_walk_in, 'source', 'site_office_walk_in', 'Site Office Walk-In', 'offline.walk_in.site_office_walk_in', true),
    (p_org_id, med_walk_in, 'source', 'tele_referral',       'Tele-Referral',       'offline.walk_in.tele_referral',       true)
  ON CONFLICT (org_id, taxonomy_path) DO NOTHING;

  -- CP channel: cp_push source
  INSERT INTO mih.sources (org_id, parent_id, level, code, display_name, taxonomy_path, is_platform_managed)
  VALUES
    (p_org_id, ch_cp, 'source', 'cp_push', 'CP Push', 'cp.cp_push', true)
  ON CONFLICT (org_id, taxonomy_path) DO NOTHING;

  -- Referral channel: customer_referral source
  INSERT INTO mih.sources (org_id, parent_id, level, code, display_name, taxonomy_path, is_platform_managed)
  VALUES
    (p_org_id, ch_referral, 'source', 'customer_referral', 'Customer Referral', 'referral.customer_referral', true)
  ON CONFLICT (org_id, taxonomy_path) DO NOTHING;
END;
$$;

-- Seed for the 2 demo orgs
SELECT mih.seed_platform_sources('00000000-0000-0000-0000-000000000001');
SELECT mih.seed_platform_sources('00000000-0000-0000-0000-000000000002');
