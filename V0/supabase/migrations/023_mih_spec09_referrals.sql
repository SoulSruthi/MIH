-- =================================================================
-- Migration: 023_mih_spec09_referrals
-- Purpose: Referral Program tables (Spec 09 V0)
-- Rule: ADDITIVE ONLY — never modify existing tables
-- =================================================================

-- -----------------------------------------------------------------
-- mih.referrers — existing customers who refer new leads
-- -----------------------------------------------------------------
CREATE TABLE mih.referrers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_cluster_id   uuid,  -- resolved identity cluster of the referrer
  name                  text,
  contact_email         text,
  contact_phone         text,
  is_active             boolean NOT NULL DEFAULT true,
  last_referral_at      timestamptz,  -- updated on each referral; drives dormancy check
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, customer_cluster_id) WHERE customer_cluster_id IS NOT NULL
);

CREATE INDEX mih_referrers_org_idx ON mih.referrers(org_id, is_active);
CREATE INDEX mih_referrers_dormancy_idx ON mih.referrers(org_id, last_referral_at) WHERE is_active = true;

ALTER TABLE mih.referrers ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_referrers_tenant_isolation ON mih.referrers
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_referrers_service_write ON mih.referrers
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.referral_events — unique per referrer+referee pair
-- -----------------------------------------------------------------
CREATE TABLE mih.referral_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  referrer_id           uuid NOT NULL REFERENCES mih.referrers(id) ON DELETE CASCADE,
  referee_cluster_id    uuid NOT NULL,  -- identity cluster of the new lead
  crm_event_id          text,  -- idempotency key
  project_id            uuid,  -- references mih.projects
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','converted','expired')),
  referred_at           timestamptz NOT NULL DEFAULT now(),
  converted_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, referrer_id, referee_cluster_id),
  UNIQUE (org_id, crm_event_id) WHERE crm_event_id IS NOT NULL
);

CREATE INDEX mih_referral_events_referrer_idx ON mih.referral_events(org_id, referrer_id, status);
CREATE INDEX mih_referral_events_referee_idx ON mih.referral_events(org_id, referee_cluster_id);

ALTER TABLE mih.referral_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_referral_events_tenant_isolation ON mih.referral_events
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_referral_events_service_write ON mih.referral_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.referral_commissions — 1.5% of deal_value_paise on booking
-- Only created when winning attribution source_type = 'referral'
-- -----------------------------------------------------------------
CREATE TABLE mih.referral_commissions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  referral_event_id     uuid NOT NULL REFERENCES mih.referral_events(id) ON DELETE CASCADE,
  conversion_event_id   uuid NOT NULL,  -- references mih.conversion_events
  deal_value_paise      bigint NOT NULL CHECK (deal_value_paise > 0),
  commission_paise      bigint NOT NULL CHECK (commission_paise > 0),
  commission_rate       numeric(6,5) NOT NULL DEFAULT 0.015,
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','paid')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, conversion_event_id)
);

CREATE INDEX mih_referral_commissions_event_idx ON mih.referral_commissions(org_id, referral_event_id);

ALTER TABLE mih.referral_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_referral_commissions_tenant_isolation ON mih.referral_commissions
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_referral_commissions_service_write ON mih.referral_commissions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
