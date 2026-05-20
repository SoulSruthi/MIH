-- =================================================================
-- Migration: 016_mih_spec02_ingestion
-- Purpose: Lead Ingestion tables (Spec 02 V0)
-- Rule: ADDITIVE ONLY — never modify existing tables
-- =================================================================

-- -----------------------------------------------------------------
-- mih.connectors — connector registry
-- -----------------------------------------------------------------
CREATE TABLE mih.connectors (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_id           uuid REFERENCES mih.sources(id),
  connector_type      text NOT NULL CHECK (connector_type IN (
                        'meta_lead_ads','google_ads','99acres','magicbricks','housing_com',
                        'nobroker','roof_and_floor','webform','telephony_inbound',
                        'cp_push','csv_import','manual'
                      )),
  display_name        text NOT NULL,
  config_encrypted    jsonb NOT NULL DEFAULT '{}',
  is_active           boolean NOT NULL DEFAULT true,
  last_sync_at        timestamptz,
  last_sync_status    text CHECK (last_sync_status IN ('success','failure','partial')),
  last_sync_error     text,
  health_state        text NOT NULL DEFAULT 'healthy'
                        CHECK (health_state IN ('healthy','degraded','failed')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mih_connectors_org_id_idx ON mih.connectors(org_id);
CREATE INDEX mih_connectors_source_id_idx ON mih.connectors(source_id);

ALTER TABLE mih.connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_connectors_tenant_isolation ON mih.connectors
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_connectors_service_write ON mih.connectors
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.raw_inbox — append-only lead inbox
-- -----------------------------------------------------------------
CREATE TABLE mih.raw_inbox (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connector_id        uuid REFERENCES mih.connectors(id),
  source_id           uuid REFERENCES mih.sources(id),
  activity_id         uuid REFERENCES mih.activities(id),
  project_id          uuid,
  ingestion_path      text NOT NULL CHECK (ingestion_path IN (
                        'webhook','pull','webform','csv','manual','cp_api','phone_inbound'
                      )),
  external_id         text,
  received_at         timestamptz NOT NULL DEFAULT now(),
  source_received_at  timestamptz,
  raw_payload         jsonb NOT NULL,
  normalized          jsonb,
  signature_verified  boolean,
  processing_state    text NOT NULL DEFAULT 'pending'
                        CHECK (processing_state IN (
                          'pending','normalized','dedup_queued','rejected','manual_review'
                        )),
  rejection_reason    text,
  manual_review_flag  text CHECK (manual_review_flag IN (
                        'manual_call_no_tracking','cp_dispute','low_quality'
                      )),
  UNIQUE (org_id, connector_id, external_id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX mih_raw_inbox_org_received_at_idx ON mih.raw_inbox(org_id, received_at DESC);
CREATE INDEX mih_raw_inbox_pending_idx ON mih.raw_inbox(processing_state, received_at)
  WHERE processing_state IN ('pending','normalized');
CREATE INDEX mih_raw_inbox_connector_id_idx ON mih.raw_inbox(connector_id);
CREATE INDEX mih_raw_inbox_source_id_idx ON mih.raw_inbox(source_id);

ALTER TABLE mih.raw_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_raw_inbox_tenant_isolation ON mih.raw_inbox
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_raw_inbox_service_write ON mih.raw_inbox
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.connector_health_events — health audit log
-- -----------------------------------------------------------------
CREATE TABLE mih.connector_health_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id  uuid NOT NULL REFERENCES mih.connectors(id) ON DELETE CASCADE,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  event_type    text NOT NULL CHECK (event_type IN (
                  'sync_success','sync_failure','auth_expired','rate_limited','payload_malformed'
                )),
  details       jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX mih_connector_health_events_connector_id_idx ON mih.connector_health_events(connector_id, occurred_at DESC);

ALTER TABLE mih.connector_health_events ENABLE ROW LEVEL SECURITY;

-- Health events accessed via connector join — org isolation via connector
CREATE POLICY mih_connector_health_events_service_write ON mih.connector_health_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY mih_connector_health_events_authenticated_read ON mih.connector_health_events
  FOR SELECT TO authenticated
  USING (
    connector_id IN (
      SELECT id FROM mih.connectors WHERE org_id = public.app_org_id()
    )
  );

-- -----------------------------------------------------------------
-- mih.webform_templates — webform configuration
-- -----------------------------------------------------------------
CREATE TABLE mih.webform_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  activity_id   uuid REFERENCES mih.activities(id),
  project_id    uuid,
  form_slug     text NOT NULL UNIQUE,
  fields_config jsonb NOT NULL,
  thank_you_url text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mih_webform_templates_org_id_idx ON mih.webform_templates(org_id);
CREATE INDEX mih_webform_templates_activity_id_idx ON mih.webform_templates(activity_id);

ALTER TABLE mih.webform_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_webform_templates_tenant_isolation ON mih.webform_templates
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_webform_templates_service_write ON mih.webform_templates
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Public read for active forms (webform endpoint is unauthenticated)
CREATE POLICY mih_webform_templates_public_read ON mih.webform_templates
  FOR SELECT TO anon
  USING (is_active = true);
