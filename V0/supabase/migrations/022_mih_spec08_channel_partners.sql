-- =================================================================
-- Migration: 022_mih_spec08_channel_partners
-- Purpose: Channel Partner Management tables (Spec 08 V0)
-- Rule: ADDITIVE ONLY — never modify existing tables
-- =================================================================

-- -----------------------------------------------------------------
-- mih.channel_partners — CP registry per org
-- -----------------------------------------------------------------
CREATE TABLE mih.channel_partners (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name                text NOT NULL,
  code                text,  -- short identifier, e.g. 'CP-001'
  contact_name        text,
  contact_email       text,
  contact_phone       text,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mih_channel_partners_org_idx ON mih.channel_partners(org_id, is_active);
CREATE UNIQUE INDEX mih_channel_partners_code_unique
  ON mih.channel_partners(org_id, code)
  WHERE code IS NOT NULL;

ALTER TABLE mih.channel_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_channel_partners_tenant_isolation ON mih.channel_partners
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_channel_partners_service_write ON mih.channel_partners
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.cp_push_events — leads pushed to a CP via inbound webhook
-- -----------------------------------------------------------------
CREATE TABLE mih.cp_push_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_partner_id  uuid NOT NULL REFERENCES mih.channel_partners(id) ON DELETE CASCADE,
  crm_event_id        text NOT NULL,  -- idempotency key from CRM
  cluster_id          uuid,  -- resolved identity cluster
  lead_name           text,
  lead_phone          text,
  lead_email          text,
  project_id          uuid,  -- references mih.projects
  pushed_at           timestamptz NOT NULL DEFAULT now(),
  raw_payload         jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, crm_event_id)
);

CREATE INDEX mih_cp_push_events_cp_idx ON mih.cp_push_events(org_id, channel_partner_id, pushed_at DESC);
CREATE INDEX mih_cp_push_events_cluster_idx ON mih.cp_push_events(org_id, cluster_id) WHERE cluster_id IS NOT NULL;

ALTER TABLE mih.cp_push_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_cp_push_events_tenant_isolation ON mih.cp_push_events
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_cp_push_events_service_write ON mih.cp_push_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.cp_commissions — 2.5% commission on booking conversions
-- Only created when winning attribution source_type = 'cp'
-- -----------------------------------------------------------------
CREATE TABLE mih.cp_commissions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_partner_id    uuid NOT NULL REFERENCES mih.channel_partners(id) ON DELETE CASCADE,
  conversion_event_id   uuid NOT NULL,  -- references mih.conversion_events
  deal_value_paise      bigint NOT NULL CHECK (deal_value_paise > 0),
  commission_paise      bigint NOT NULL CHECK (commission_paise > 0),
  commission_rate       numeric(6,5) NOT NULL DEFAULT 0.025,
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','paid','disputed')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, conversion_event_id)
);

CREATE INDEX mih_cp_commissions_cp_idx ON mih.cp_commissions(org_id, channel_partner_id, status);

ALTER TABLE mih.cp_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_cp_commissions_tenant_isolation ON mih.cp_commissions
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_cp_commissions_service_write ON mih.cp_commissions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.cp_performance — monthly rollup per CP
-- -----------------------------------------------------------------
CREATE TABLE mih.cp_performance (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_partner_id      uuid NOT NULL REFERENCES mih.channel_partners(id) ON DELETE CASCADE,
  month_year              text NOT NULL,  -- 'YYYY-MM', e.g. '2026-04'
  leads_pushed_count      int NOT NULL DEFAULT 0,
  bookings_count          int NOT NULL DEFAULT 0,
  bookings_value_paise    bigint NOT NULL DEFAULT 0,
  commission_paise        bigint NOT NULL DEFAULT 0,
  last_refreshed_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, channel_partner_id, month_year)
);

CREATE INDEX mih_cp_performance_cp_idx ON mih.cp_performance(org_id, channel_partner_id, month_year DESC);

ALTER TABLE mih.cp_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_cp_performance_tenant_isolation ON mih.cp_performance
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_cp_performance_service_write ON mih.cp_performance
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
