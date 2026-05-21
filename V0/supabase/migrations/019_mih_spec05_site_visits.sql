-- =================================================================
-- Migration: 019_mih_spec05_site_visits
-- Purpose: Site Visit Events tables (Spec 05 V0)
-- Rule: ADDITIVE ONLY — never modify existing tables
-- =================================================================

-- -----------------------------------------------------------------
-- mih.site_visit_events — projection of CRM site visit events
-- -----------------------------------------------------------------
CREATE TABLE mih.site_visit_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  crm_event_id        text NOT NULL,
  cluster_id          uuid REFERENCES mih.identity_clusters(id),
  conversion_event_id uuid REFERENCES mih.conversion_events(id),
  event_kind          text NOT NULL CHECK (event_kind IN (
                        'scheduled','rescheduled','cab_dispatched',
                        'customer_en_route','completed','no_show',
                        'cancelled','walk_in_unscheduled'
                      )),
  project_id          uuid,  -- references mih.projects once available
  source_id           uuid,  -- references mih.sources if known
  is_fast_track       boolean NOT NULL DEFAULT false,
  is_walk_in          boolean NOT NULL DEFAULT false,
  cab_booked          boolean NOT NULL DEFAULT false,
  scheduled_at        timestamptz,
  completed_at        timestamptz,
  crm_metadata        jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, crm_event_id)
);

CREATE INDEX mih_site_visit_events_cluster_idx ON mih.site_visit_events(org_id, cluster_id);
CREATE INDEX mih_site_visit_events_project_idx ON mih.site_visit_events(org_id, project_id);
CREATE INDEX mih_site_visit_events_kind_idx ON mih.site_visit_events(org_id, event_kind, created_at DESC);

ALTER TABLE mih.site_visit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_site_visit_events_tenant_isolation ON mih.site_visit_events
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_site_visit_events_service_write ON mih.site_visit_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.portal_site_visit_targets — monthly SLA targets per source per project
-- -----------------------------------------------------------------
CREATE TABLE mih.portal_site_visit_targets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_id           uuid NOT NULL,  -- references mih.sources
  project_id          uuid,           -- null = org-wide target
  target_month        date NOT NULL,  -- first day of month
  target_count        int NOT NULL,
  actual_count        int NOT NULL DEFAULT 0,
  last_computed_at    timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, source_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), target_month)
);

CREATE INDEX mih_portal_sv_targets_month_idx ON mih.portal_site_visit_targets(org_id, target_month DESC);

ALTER TABLE mih.portal_site_visit_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_portal_site_visit_targets_tenant_isolation ON mih.portal_site_visit_targets
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_portal_site_visit_targets_service_write ON mih.portal_site_visit_targets
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.site_visit_attribution_log — denormalized view for fast dashboards
-- -----------------------------------------------------------------
CREATE TABLE mih.site_visit_attribution_log (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_visit_event_id     uuid NOT NULL REFERENCES mih.site_visit_events(id) ON DELETE CASCADE,
  attribution_result_id   uuid REFERENCES mih.attribution_results(id),
  winning_source_id       uuid,
  project_id              uuid,
  event_kind              text NOT NULL,
  is_fast_track           boolean NOT NULL DEFAULT false,
  visit_date              date NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, site_visit_event_id)
);

CREATE INDEX mih_sv_attribution_log_source_idx ON mih.site_visit_attribution_log(org_id, winning_source_id, visit_date DESC);
CREATE INDEX mih_sv_attribution_log_project_idx ON mih.site_visit_attribution_log(org_id, project_id, visit_date DESC);

ALTER TABLE mih.site_visit_attribution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_site_visit_attribution_log_tenant_isolation ON mih.site_visit_attribution_log
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_site_visit_attribution_log_service_write ON mih.site_visit_attribution_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
