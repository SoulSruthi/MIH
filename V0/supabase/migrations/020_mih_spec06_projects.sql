-- =================================================================
-- Migration: 020_mih_spec06_projects
-- Purpose: Projects tables (Spec 06 V0)
-- Rule: ADDITIVE ONLY — never modify existing tables
-- =================================================================

-- -----------------------------------------------------------------
-- mih.projects — MIH projection of CRM project entity
-- -----------------------------------------------------------------
CREATE TABLE mih.projects (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  crm_project_id              text,  -- CRM system-of-record ID
  display_name                text NOT NULL,
  avg_sqft                    numeric(10,2),
  price_per_sqft              bigint,  -- in paise
  avg_ticket_value            bigint,  -- in paise, derived = avg_sqft * price_per_sqft
  fy_booking_target_count     int,
  fy_booking_target_value     bigint,  -- in paise
  marketing_spend_pct         numeric(5,4) NOT NULL DEFAULT 0.02,  -- 2% default
  fy_marketing_budget         bigint GENERATED ALWAYS AS (
    CASE WHEN fy_booking_target_value IS NOT NULL
    THEN ROUND(fy_booking_target_value * marketing_spend_pct)::bigint
    ELSE NULL END
  ) STORED,
  lifecycle_stage             text NOT NULL DEFAULT 'pre_launch'
                                CHECK (lifecycle_stage IN (
                                  'pre_launch','launch','mid_construction',
                                  'near_handover','handover_complete'
                                )),
  marketing_manager_user_id   uuid,
  launch_date                 date,
  crm_synced_at               timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, crm_project_id) WHERE crm_project_id IS NOT NULL
);

CREATE INDEX mih_projects_org_stage_idx ON mih.projects(org_id, lifecycle_stage);
CREATE INDEX mih_projects_crm_id_idx ON mih.projects(org_id, crm_project_id) WHERE crm_project_id IS NOT NULL;

ALTER TABLE mih.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_projects_tenant_isolation ON mih.projects
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_projects_service_write ON mih.projects
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.project_source_allowlist — which sources are active per project per stage
-- -----------------------------------------------------------------
CREATE TABLE mih.project_source_allowlist (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id          uuid NOT NULL REFERENCES mih.projects(id) ON DELETE CASCADE,
  source_id           uuid NOT NULL,  -- references mih.sources
  applicable_stages   text[] NOT NULL DEFAULT '{pre_launch,launch,mid_construction,near_handover}',
  auto_disable_at     timestamptz,  -- e.g. launch_date + 60d for TV ads
  enabled             boolean NOT NULL DEFAULT true,
  enabled_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, project_id, source_id)
);

CREATE INDEX mih_project_source_allowlist_project_idx ON mih.project_source_allowlist(org_id, project_id, enabled);

ALTER TABLE mih.project_source_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_project_source_allowlist_tenant_isolation ON mih.project_source_allowlist
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_project_source_allowlist_service_write ON mih.project_source_allowlist
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.project_stage_history — audit trail of lifecycle stage transitions
-- -----------------------------------------------------------------
CREATE TABLE mih.project_stage_history (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id          uuid NOT NULL REFERENCES mih.projects(id) ON DELETE CASCADE,
  from_stage          text,
  to_stage            text NOT NULL,
  transitioned_by     uuid,
  notes               text,
  occurred_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mih_project_stage_history_project_idx ON mih.project_stage_history(project_id, occurred_at DESC);

ALTER TABLE mih.project_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_project_stage_history_tenant_isolation ON mih.project_stage_history
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_project_stage_history_service_write ON mih.project_stage_history
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.project_source_history — materialized attribution × conversion by project+source
-- Used for Spec 07 "split budget by past-trend" calculation
-- -----------------------------------------------------------------
CREATE TABLE mih.project_source_history (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id          uuid NOT NULL REFERENCES mih.projects(id) ON DELETE CASCADE,
  source_id           uuid NOT NULL,
  fy_year             int NOT NULL,  -- financial year start year, e.g. 2026 for FY2026-27
  event_code          text NOT NULL,
  bookings_count      int NOT NULL DEFAULT 0,
  bookings_value      bigint NOT NULL DEFAULT 0,  -- in paise
  leads_count         int NOT NULL DEFAULT 0,
  last_refreshed_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, project_id, source_id, fy_year, event_code)
);

CREATE INDEX mih_project_source_history_project_fy_idx ON mih.project_source_history(org_id, project_id, fy_year);
CREATE INDEX mih_project_source_history_source_idx ON mih.project_source_history(org_id, source_id, fy_year);

ALTER TABLE mih.project_source_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_project_source_history_tenant_isolation ON mih.project_source_history
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_project_source_history_service_write ON mih.project_source_history
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
