-- =================================================================
-- Migration: 003_connector_framework
-- Directive: M-003 Connector Framework
-- Rule: ADDITIVE ONLY
-- =================================================================

-- -----------------------------------------------------------------
-- 1. Sources (one row per connected ad platform per org)
-- -----------------------------------------------------------------
CREATE TABLE sources (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_kind           text NOT NULL,
  -- Valid: meta_lead_ads, google_ads, 99acres, magicbricks,
  --        housing_com, justdial, webform, walk_in, csv_upload, channel_partner
  display_name          text NOT NULL,
  credential_id         uuid REFERENCES credentials(id),
  config                jsonb NOT NULL DEFAULT '{}',
  state                 text NOT NULL DEFAULT 'unauthorized'
                          CHECK (state IN (
                            'unauthorized','authorized','active',
                            'degraded','paused','revoked')),
  health_score          smallint NOT NULL DEFAULT 100
                          CHECK (health_score BETWEEN 0 AND 100),
  last_sync_at          timestamptz,
  last_sync_status      text
                          CHECK (last_sync_status IN ('success','partial','failed',null)),
  last_error_message    text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sources_org_kind_idx ON sources(organization_id, source_kind);
CREATE INDEX sources_org_state_idx ON sources(organization_id, state)
  WHERE state = 'active';

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY sources_tenant_isolation ON sources
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());

-- -----------------------------------------------------------------
-- 2. Connector DLQ
-- -----------------------------------------------------------------
CREATE TABLE connector_dlq (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id             uuid REFERENCES sources(id),
  failure_stage         text NOT NULL
                          CHECK (failure_stage IN ('fetch','normalize','ingest','dedup','handoff')),
  raw_payload           jsonb,
  error_message         text NOT NULL,
  error_code            text,
  retry_count           int NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'failed'
                          CHECK (status IN ('failed','retrying','replayed','ignored')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  replayed_at           timestamptz,
  replayed_by           uuid
);

CREATE INDEX connector_dlq_org_status_idx
  ON connector_dlq(organization_id, status, created_at DESC)
  WHERE status IN ('failed','retrying');

ALTER TABLE connector_dlq ENABLE ROW LEVEL SECURITY;
CREATE POLICY connector_dlq_tenant_isolation ON connector_dlq
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());
