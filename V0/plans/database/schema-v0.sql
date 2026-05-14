-- =================================================================
-- MIH V0 CANONICAL SCHEMA
-- Authority: Builtrix Labs
-- Version: V0.1
-- Migration: run via scripts/v5/supabase.sh
-- Rule: ADDITIVE ONLY — no field renames, no drops after V0 ships
-- =================================================================


-- =================================================================
-- TENANCY
-- =================================================================

CREATE TABLE organizations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  slug                  text NOT NULL UNIQUE,
  builder_brand         text,
  rera_number           text,
  gstin                 text,
  -- Sister-product linkage (1:1 per product per locked decision H.1)
  crm_organization_id   uuid,
  crm_base_url          text NOT NULL DEFAULT 'https://crm.builtrix.io',
  crm_api_token_id      uuid,  -- FK to credentials(id), set after CRM connection
  crm_hmac_secret_id    uuid,  -- FK to credentials(id)
  -- Lifecycle
  tier                  text NOT NULL DEFAULT 'standard'
                          CHECK (tier IN ('standard','enterprise')),
  status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','suspended','deleted')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

CREATE TABLE memberships (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL,   -- Supabase Auth user id
  base_role             text NOT NULL
                          CHECK (base_role IN ('super_admin','org_user')),
  app_roles             text[] NOT NULL DEFAULT '{}',
  -- Valid app_roles: mih_org_admin, marketing_manager,
  --   marketing_analyst, marketing_ops, org_viewer
  status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','suspended','removed')),
  invited_by            uuid,  -- user_id of inviter
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- RLS on memberships
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY memberships_tenant_isolation ON memberships
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());


-- =================================================================
-- CREDENTIALS (all secrets encrypted at app layer — DB sees ciphertext only)
-- =================================================================

CREATE TABLE credentials (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind                  text NOT NULL
                          CHECK (kind IN ('oauth_token','api_key','hmac_secret','bearer_token')),
  display_label         text NOT NULL,
  ciphertext            bytea NOT NULL,   -- AES-256-GCM encrypted
  nonce                 bytea NOT NULL,
  rotated_at            timestamptz,
  expires_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY credentials_tenant_isolation ON credentials
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());

-- FK constraints on organizations (deferred to avoid circular reference at creation)
ALTER TABLE organizations
  ADD CONSTRAINT org_crm_api_token_fk FOREIGN KEY (crm_api_token_id) REFERENCES credentials(id),
  ADD CONSTRAINT org_crm_hmac_secret_fk FOREIGN KEY (crm_hmac_secret_id) REFERENCES credentials(id);


-- =================================================================
-- SOURCES (one row per connected ad platform per org)
-- =================================================================

CREATE TABLE sources (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_kind           text NOT NULL,
  -- Valid: meta_lead_ads, google_ads, 99acres, magicbricks,
  --        housing_com, justdial, webform, walk_in, csv_upload, channel_partner
  display_name          text NOT NULL,
  credential_id         uuid REFERENCES credentials(id),
  config                jsonb NOT NULL DEFAULT '{}',
  -- config includes: form_id mappings, page_id (Meta), customer_id (Google), etc.
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

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY sources_tenant_isolation ON sources
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());


-- =================================================================
-- DEDUP RULES (per-org configuration)
-- =================================================================

CREATE TABLE dedup_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  phone_window_hours    int NOT NULL DEFAULT 24
                          CHECK (phone_window_hours BETWEEN 1 AND 720),
  email_dedup_enabled   boolean NOT NULL DEFAULT false,
  fuzzy_phone_enabled   boolean NOT NULL DEFAULT true,
  post_window_behavior  text NOT NULL DEFAULT 'new_lead'
                          CHECK (post_window_behavior IN ('new_lead','merge_existing')),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid
);

ALTER TABLE dedup_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY dedup_rules_tenant_isolation ON dedup_rules
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());


-- =================================================================
-- SUBSTRATE LAYER 1: RAW LEADS (immutable — NEVER UPDATE)
-- =================================================================

CREATE TABLE raw_leads (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id             uuid NOT NULL REFERENCES sources(id),
  source_external_id    text NOT NULL,
  -- Normalized identifiers
  phone_e164            text NOT NULL,
  email                 text,
  name                  text NOT NULL,
  -- Campaign attribution (from source)
  source_campaign_id    text,
  source_campaign_name  text,
  source_ad_id          text,
  source_ad_name        text,
  source_creative_id    text,
  source_keyword        text,
  source_referrer_url   text,
  source_received_at    timestamptz NOT NULL,
  ingested_at           timestamptz NOT NULL DEFAULT now(),
  -- Idempotency (sha256 of canonical payload — prevents double-insert from retries)
  payload_hash          text NOT NULL,
  raw_payload           jsonb NOT NULL,
  -- Dedup decision (written by dedup engine; do not mutate other fields)
  dedup_status          text NOT NULL DEFAULT 'pending'
                          CHECK (dedup_status IN ('pending','unique','duplicate','merged_into_unique')),
  unique_lead_id        uuid,
  -- Constraints
  UNIQUE (source_id, source_external_id),
  UNIQUE (organization_id, payload_hash)
);

CREATE INDEX raw_leads_org_phone_idx
  ON raw_leads(organization_id, phone_e164, source_received_at DESC);
CREATE INDEX raw_leads_org_ingested_idx
  ON raw_leads(organization_id, ingested_at DESC);
CREATE INDEX raw_leads_dedup_pending_idx
  ON raw_leads(organization_id, dedup_status)
  WHERE dedup_status = 'pending';

ALTER TABLE raw_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY raw_leads_tenant_isolation ON raw_leads
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());


-- =================================================================
-- SUBSTRATE LAYER 2: CRM LIFECYCLE EVENTS (immutable)
-- =================================================================

CREATE TABLE crm_lifecycle_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id              text NOT NULL,
  event_kind            text NOT NULL,
  -- Valid: lead.received, lead.assigned, lead.contacted, lead.qualified,
  --   lead.lost, lead.junk, lead.site_visit_scheduled, lead.site_visit_completed,
  --   deal.created, deal.won, deal.lost
  crm_lead_id           uuid NOT NULL,
  mih_unique_lead_id    uuid,
  external_id           text,
  payload               jsonb NOT NULL,
  received_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, event_id)
);

CREATE INDEX crm_events_org_lead_idx
  ON crm_lifecycle_events(organization_id, mih_unique_lead_id, received_at DESC);

ALTER TABLE crm_lifecycle_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_events_tenant_isolation ON crm_lifecycle_events
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());


-- =================================================================
-- SUBSTRATE LAYER 3: SPEND (append-only; corrections = new row with superseded_by)
-- =================================================================

CREATE TABLE spend_daily (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id             uuid NOT NULL REFERENCES sources(id),
  campaign_id           text,
  campaign_name         text,
  ad_id                 text,
  date                  date NOT NULL,
  spend_inr             numeric(12,2) NOT NULL DEFAULT 0,
  impressions           bigint,
  clicks                bigint,
  entry_method          text NOT NULL DEFAULT 'manual'
                          CHECK (entry_method IN ('api','manual','csv')),
  entered_by            uuid,
  superseded_by         uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source_id, campaign_id, date, superseded_by)
);

CREATE INDEX spend_daily_org_source_date_idx
  ON spend_daily(organization_id, source_id, date DESC);

ALTER TABLE spend_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY spend_daily_tenant_isolation ON spend_daily
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());


-- =================================================================
-- SUBSTRATE LAYER 4: AUDIT LOG (immutable, append-only)
-- =================================================================

CREATE TABLE audit_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid,
  actor_id              uuid,
  actor_type            text NOT NULL
                          CHECK (actor_type IN ('user','system','connector','sister_product')),
  action                text NOT NULL,
  table_name            text,
  record_id             text,
  before_state          jsonb,
  after_state           jsonb,
  meta                  jsonb,
  ip_address            inet,
  request_id            text,
  created_at            timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

CREATE INDEX audit_log_org_idx ON audit_log(organization_id, created_at DESC);
CREATE INDEX audit_log_resource_idx ON audit_log(table_name, record_id, created_at DESC);

-- Immutability guard
CREATE OR REPLACE FUNCTION audit_log_immutability_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log rows are immutable';
END;
$$;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutability_guard();


-- =================================================================
-- IDENTITY LAYER: IDENTITY GRAPH
-- =================================================================

CREATE TABLE identity_clusters (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cluster_confidence    numeric(3,2) NOT NULL DEFAULT 1.0,
  primary_unique_lead_id uuid,
  merged_from_clusters  uuid[] NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE identity_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY identity_clusters_tenant_isolation ON identity_clusters
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());

CREATE TABLE identity_identifiers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cluster_id            uuid NOT NULL REFERENCES identity_clusters(id),
  identifier_type       text NOT NULL
                          CHECK (identifier_type IN ('phone_e164','email','ad_platform_id','crm_id')),
  identifier_value      text NOT NULL,
  confidence            numeric(3,2) NOT NULL DEFAULT 1.0,
  verified              boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, identifier_type, identifier_value)
);

CREATE INDEX identity_identifiers_cluster_idx
  ON identity_identifiers(organization_id, cluster_id);
CREATE INDEX identity_identifiers_lookup_idx
  ON identity_identifiers(organization_id, identifier_type, identifier_value);

ALTER TABLE identity_identifiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY identity_identifiers_tenant_isolation ON identity_identifiers
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());


-- =================================================================
-- IDENTITY LAYER: UNIQUE LEADS (projection on identity graph)
-- =================================================================

CREATE TABLE unique_leads (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  identity_cluster_id   uuid NOT NULL REFERENCES identity_clusters(id),
  primary_phone_e164    text NOT NULL,
  primary_email         text,
  primary_name          text NOT NULL,
  first_seen_at         timestamptz NOT NULL,
  last_seen_at          timestamptz NOT NULL,
  primary_source_id     uuid NOT NULL REFERENCES sources(id),
  total_touches         int NOT NULL DEFAULT 1,
  touch_sources         jsonb NOT NULL DEFAULT '[]',
  -- Real-estate preference (V0/V1 hardcoded; V2 → custom fields)
  preference_bhk        text,
  preference_budget_band text,
  preference_location   text,
  -- MIH AI enrichment (V2+, columns present now for schema stability)
  mih_intent_score      int CHECK (mih_intent_score BETWEEN 0 AND 100),
  mih_quality_grade     text CHECK (mih_quality_grade IN ('A','B','C','D')),
  -- CRM linkage
  crm_lead_id           uuid,
  crm_external_id       text UNIQUE,
  crm_handoff_status    text NOT NULL DEFAULT 'pending'
                          CHECK (crm_handoff_status IN (
                            'pending','queued','succeeded','failed','skipped')),
  crm_handoff_at        timestamptz,
  last_lifecycle_state  text,
  last_lifecycle_at     timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, primary_phone_e164)
);

CREATE INDEX unique_leads_org_phone_idx ON unique_leads(organization_id, primary_phone_e164);
CREATE INDEX unique_leads_org_handoff_idx
  ON unique_leads(organization_id, crm_handoff_status)
  WHERE crm_handoff_status IN ('pending','queued','failed');
CREATE INDEX unique_leads_org_created_idx ON unique_leads(organization_id, created_at DESC);

ALTER TABLE unique_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY unique_leads_tenant_isolation ON unique_leads
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());

-- FK from raw_leads back to unique_leads (deferred)
ALTER TABLE raw_leads
  ADD CONSTRAINT raw_leads_unique_lead_fk FOREIGN KEY (unique_lead_id) REFERENCES unique_leads(id);


-- =================================================================
-- DELIVERY TRACKING
-- =================================================================

CREATE TABLE outbound_deliveries (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  unique_lead_id        uuid NOT NULL REFERENCES unique_leads(id),
  target                text NOT NULL DEFAULT 'crm',
  endpoint_url          text NOT NULL,
  idempotency_key       text NOT NULL,
  attempt_number        int NOT NULL DEFAULT 1,
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','in_flight','succeeded','failed','dlq')),
  http_status           int,
  response_body         text,
  error_message         text,
  attempted_at          timestamptz NOT NULL DEFAULT now(),
  next_retry_at         timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outbound_deliveries_lead_idx
  ON outbound_deliveries(organization_id, unique_lead_id, attempted_at DESC);
CREATE INDEX outbound_deliveries_retry_idx
  ON outbound_deliveries(organization_id, status, next_retry_at)
  WHERE status IN ('pending','failed');

ALTER TABLE outbound_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY outbound_deliveries_tenant_isolation ON outbound_deliveries
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());


-- =================================================================
-- CONNECTOR DLQ
-- =================================================================

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

ALTER TABLE connector_dlq ENABLE ROW LEVEL SECURITY;
CREATE POLICY connector_dlq_tenant_isolation ON connector_dlq
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());


-- =================================================================
-- CAMPAIGNS (synced from vendor; supports spend attribution)
-- =================================================================

CREATE TABLE campaigns (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id             uuid NOT NULL REFERENCES sources(id),
  source_campaign_id    text NOT NULL,
  name                  text NOT NULL,
  status                text,
  start_date            date,
  end_date              date,
  metadata              jsonb NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, source_campaign_id)
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaigns_tenant_isolation ON campaigns
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());


-- =================================================================
-- ATTRIBUTION PROJECTION (nightly recompute + on-demand)
-- =================================================================

CREATE TABLE attribution_rollups (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  model_version         text NOT NULL DEFAULT 'last_touch_v1',
  period_type           text NOT NULL CHECK (period_type IN ('day','week','month')),
  period_start          date NOT NULL,
  source_id             uuid REFERENCES sources(id),
  campaign_id           text,
  campaign_name         text,
  ad_id                 text,
  ad_name               text,
  creative_id           text,
  attribution_model     text NOT NULL DEFAULT 'last_touch'
                          CHECK (attribution_model IN ('last_touch','first_touch','linear','time_decay')),
  raw_lead_count        int NOT NULL DEFAULT 0,
  unique_lead_count     int NOT NULL DEFAULT 0,
  duplicate_count       int NOT NULL DEFAULT 0,
  contacted_count       int NOT NULL DEFAULT 0,
  qualified_count       int NOT NULL DEFAULT 0,
  site_visit_count      int NOT NULL DEFAULT 0,
  deal_count            int NOT NULL DEFAULT 0,
  deals_won_count       int NOT NULL DEFAULT 0,
  spend_inr             numeric(12,2) NOT NULL DEFAULT 0,
  revenue_inr           numeric(15,2) NOT NULL DEFAULT 0,
  cpl_inr               numeric(12,2),
  cpa_inr               numeric(12,2),
  roas                  numeric(8,4),
  computed_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, model_version, period_type, period_start,
          source_id, campaign_id, ad_id, creative_id, attribution_model)
);

CREATE INDEX attribution_rollups_org_period_idx
  ON attribution_rollups(organization_id, period_type, period_start DESC, attribution_model);

ALTER TABLE attribution_rollups ENABLE ROW LEVEL SECURITY;
CREATE POLICY attribution_rollups_tenant_isolation ON attribution_rollups
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());


-- =================================================================
-- RLS CORE: app_org_id() JWT-backed resolver (create first, used by all policies)
-- =================================================================

CREATE OR REPLACE FUNCTION public.app_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json->>'organization_id',
    ''
  )::uuid
$$;


-- =================================================================
-- TENANT-LEAK AUDIT (mandatory from M-001, run nightly)
-- =================================================================

CREATE SCHEMA IF NOT EXISTS audit;

CREATE OR REPLACE FUNCTION audit.tenant_leak_check()
RETURNS TABLE (table_name text, issue text, example_id text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Check 1: NULL organization_id in tenant-scoped tables
  RETURN QUERY
    SELECT 'raw_leads'::text, 'NULL organization_id'::text, id::text
    FROM raw_leads WHERE organization_id IS NULL LIMIT 1;

  RETURN QUERY
    SELECT 'unique_leads'::text, 'NULL organization_id'::text, id::text
    FROM unique_leads WHERE organization_id IS NULL LIMIT 1;

  -- Check 2: organization_id referencing non-existent org
  RETURN QUERY
    SELECT 'raw_leads'::text, 'orphan organization_id'::text, rl.id::text
    FROM raw_leads rl
    LEFT JOIN organizations o ON rl.organization_id = o.id
    WHERE o.id IS NULL LIMIT 1;

  -- Check 3: cross-tenant FK violation (raw_lead.org != unique_lead.org)
  RETURN QUERY
    SELECT 'raw_leads'::text, 'cross-tenant unique_lead FK'::text, rl.id::text
    FROM raw_leads rl
    JOIN unique_leads ul ON rl.unique_lead_id = ul.id
    WHERE rl.organization_id != ul.organization_id LIMIT 1;

END;
$$;
