-- =================================================================
-- Migration: 006_identity_graph
-- Directive: M-006 Dedup Engine + Identity Graph
-- Rule: ADDITIVE ONLY
-- =================================================================

-- -----------------------------------------------------------------
-- DEDUP RULES (per-org configuration)
-- -----------------------------------------------------------------

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

CREATE POLICY dedup_rules_tenant_read ON dedup_rules
  FOR SELECT
  USING (organization_id = public.app_org_id());

CREATE POLICY dedup_rules_service_write ON dedup_rules
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------
-- IDENTITY CLUSTERS (one cluster = one real-world person)
-- -----------------------------------------------------------------

CREATE TABLE identity_clusters (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cluster_confidence     numeric(3,2) NOT NULL DEFAULT 1.0,
  primary_unique_lead_id uuid,  -- populated after first unique_lead is created
  merged_from_clusters   uuid[] NOT NULL DEFAULT '{}',
  created_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE identity_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY identity_clusters_tenant_isolation ON identity_clusters
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());

-- -----------------------------------------------------------------
-- IDENTITY IDENTIFIERS (lookup keys per cluster)
-- -----------------------------------------------------------------

CREATE TABLE identity_identifiers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cluster_id       uuid NOT NULL REFERENCES identity_clusters(id),
  identifier_type  text NOT NULL
                     CHECK (identifier_type IN ('phone_e164','email','ad_platform_id','crm_id')),
  identifier_value text NOT NULL,
  confidence       numeric(3,2) NOT NULL DEFAULT 1.0,
  verified         boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
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

-- -----------------------------------------------------------------
-- UNIQUE LEADS (projection: one row per real person per org)
-- -----------------------------------------------------------------

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
  -- Real-estate preferences (V0/V1 hardcoded; V2 → custom fields)
  preference_bhk        text,
  preference_budget_band text,
  preference_location   text,
  -- MIH AI enrichment placeholders (V2+; columns present for schema stability)
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

CREATE INDEX unique_leads_org_phone_idx
  ON unique_leads(organization_id, primary_phone_e164);

CREATE INDEX unique_leads_org_handoff_idx
  ON unique_leads(organization_id, crm_handoff_status)
  WHERE crm_handoff_status IN ('pending','queued','failed');

CREATE INDEX unique_leads_org_created_idx
  ON unique_leads(organization_id, created_at DESC);

ALTER TABLE unique_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY unique_leads_tenant_isolation ON unique_leads
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());

-- updated_at trigger
CREATE OR REPLACE FUNCTION unique_leads_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER unique_leads_updated_at
  BEFORE UPDATE ON unique_leads
  FOR EACH ROW EXECUTE FUNCTION unique_leads_set_updated_at();

-- -----------------------------------------------------------------
-- FK: raw_leads.unique_lead_id → unique_leads.id (deferred add)
-- -----------------------------------------------------------------

ALTER TABLE raw_leads
  ADD CONSTRAINT raw_leads_unique_lead_fk
  FOREIGN KEY (unique_lead_id) REFERENCES unique_leads(id);

-- -----------------------------------------------------------------
-- FK: identity_clusters.primary_unique_lead_id → unique_leads.id
-- -----------------------------------------------------------------

ALTER TABLE identity_clusters
  ADD CONSTRAINT identity_clusters_primary_lead_fk
  FOREIGN KEY (primary_unique_lead_id) REFERENCES unique_leads(id);

-- -----------------------------------------------------------------
-- ROLLBACK (reference — never run in forward migration)
-- =================================================================
-- ALTER TABLE identity_clusters DROP CONSTRAINT IF EXISTS identity_clusters_primary_lead_fk;
-- ALTER TABLE raw_leads DROP CONSTRAINT IF EXISTS raw_leads_unique_lead_fk;
-- DROP TABLE IF EXISTS unique_leads CASCADE;
-- DROP TABLE IF EXISTS identity_identifiers CASCADE;
-- DROP TABLE IF EXISTS identity_clusters CASCADE;
-- DROP TABLE IF EXISTS dedup_rules CASCADE;
-- =================================================================
