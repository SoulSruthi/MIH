-- =================================================================
-- Migration: 018_mih_spec04_attribution
-- Purpose: Attribution Engine tables (Spec 04 V0)
-- Rule: ADDITIVE ONLY — never modify existing tables
-- =================================================================

-- -----------------------------------------------------------------
-- mih.attribution_models — versioned model registry
-- -----------------------------------------------------------------
CREATE TABLE mih.attribution_models (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  model_code          text NOT NULL,  -- e.g. 'first_touch_v1', 'last_touch_v1', 'time_decay_v1'
  display_name        text NOT NULL,
  description         text,
  is_operational      boolean NOT NULL DEFAULT false,  -- only one per org should be true
  is_comparison       boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, model_code)
);

ALTER TABLE mih.attribution_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_attribution_models_tenant_isolation ON mih.attribution_models
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_attribution_models_service_write ON mih.attribution_models
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.attribution_config — per-tenant attribution configuration
-- -----------------------------------------------------------------
CREATE TABLE mih.attribution_config (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  operational_model_id        uuid REFERENCES mih.attribution_models(id),
  conversion_window_days      int NOT NULL DEFAULT 60,
  household_rule_enabled      boolean NOT NULL DEFAULT true,
  cp_claim_block_rule_enabled boolean NOT NULL DEFAULT true,
  cp_claim_grace_minutes      int NOT NULL DEFAULT 0,
  manual_override_allowed     boolean NOT NULL DEFAULT true,
  recompute_on_unmerge        boolean NOT NULL DEFAULT true,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mih.attribution_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_attribution_config_tenant_isolation ON mih.attribution_config
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_attribution_config_service_write ON mih.attribution_config
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.conversion_events — what gets attributed
-- -----------------------------------------------------------------
CREATE TABLE mih.conversion_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cluster_id          uuid NOT NULL REFERENCES mih.identity_clusters(id),
  crm_event_id        text,  -- external CRM reference
  event_code          text NOT NULL CHECK (event_code IN (
                        'lead_received','contacted','qualified',
                        'site_visit_scheduled','site_visit_completed',
                        'deal_created','deal_won','deal_lost'
                      )),
  project_id          uuid,  -- references mih.projects once that table exists
  deal_value_paise    bigint,
  occurred_at         timestamptz NOT NULL,
  reversed_at         timestamptz,
  reversed_reason     text,
  source_metadata     jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, crm_event_id) WHERE crm_event_id IS NOT NULL
);

CREATE INDEX mih_conversion_events_cluster_idx ON mih.conversion_events(org_id, cluster_id, event_code);
CREATE INDEX mih_conversion_events_occurred_idx ON mih.conversion_events(org_id, occurred_at DESC);

ALTER TABLE mih.conversion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_conversion_events_tenant_isolation ON mih.conversion_events
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_conversion_events_service_write ON mih.conversion_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.attribution_results — model output per conversion event
-- -----------------------------------------------------------------
CREATE TABLE mih.attribution_results (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversion_event_id     uuid NOT NULL REFERENCES mih.conversion_events(id),
  model_id                uuid NOT NULL REFERENCES mih.attribution_models(id),
  cluster_id              uuid NOT NULL REFERENCES mih.identity_clusters(id),
  winning_source_id       uuid,  -- references mih.sources
  winning_raw_lead_id     uuid,  -- references mih.raw_inbox
  winning_touch_at        timestamptz,
  weight                  numeric(5,4) NOT NULL DEFAULT 1.0,  -- 1.0 = full credit; for future multi-touch
  reason                  text NOT NULL,  -- e.g. 'first_touch', 'cp_claim_blocked', 'household_first_member'
  rule_applied            text NOT NULL,  -- e.g. 'first_touch_v1', 'household_first_member_rule'
  computation_inputs      jsonb NOT NULL DEFAULT '{}',  -- snapshot for explainability
  superseded_by_id        uuid REFERENCES mih.attribution_results(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, conversion_event_id, model_id) WHERE superseded_by_id IS NULL
);

CREATE INDEX mih_attribution_results_cluster_idx ON mih.attribution_results(org_id, cluster_id);
CREATE INDEX mih_attribution_results_source_idx ON mih.attribution_results(org_id, winning_source_id);

ALTER TABLE mih.attribution_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_attribution_results_tenant_isolation ON mih.attribution_results
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_attribution_results_service_write ON mih.attribution_results
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.disputed_attributions — dispute queue (feeds Spec 11)
-- -----------------------------------------------------------------
CREATE TABLE mih.disputed_attributions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  attribution_result_id   uuid NOT NULL REFERENCES mih.attribution_results(id),
  conversion_event_id     uuid NOT NULL REFERENCES mih.conversion_events(id),
  dispute_reason          text NOT NULL CHECK (dispute_reason IN (
                            'cp_claim_blocked','household_override',
                            'manual_override','cluster_mutation'
                          )),
  dispute_context         jsonb NOT NULL DEFAULT '{}',
  state                   text NOT NULL DEFAULT 'open' CHECK (state IN (
                            'open','in_review','resolved','escalated'
                          )),
  resolved_by             uuid,
  resolved_at             timestamptz,
  resolution_notes        text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mih_disputed_attributions_state_idx ON mih.disputed_attributions(org_id, state, created_at DESC);

ALTER TABLE mih.disputed_attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_disputed_attributions_tenant_isolation ON mih.disputed_attributions
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_disputed_attributions_service_write ON mih.disputed_attributions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
