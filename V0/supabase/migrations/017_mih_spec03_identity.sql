-- =================================================================
-- Migration: 017_mih_spec03_identity
-- Purpose: Identity Resolution tables (Spec 03 V0)
-- Rule: ADDITIVE ONLY — never modify existing tables
-- =================================================================

-- -----------------------------------------------------------------
-- mih.identity_nodes — individual attribute observations
-- -----------------------------------------------------------------
CREATE TABLE mih.identity_nodes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  raw_lead_id         uuid REFERENCES mih.raw_inbox(id),
  attribute_type      text NOT NULL CHECK (attribute_type IN ('phone','email','name','alt_phone')),
  attribute_value     text NOT NULL,
  attribute_value_raw text,
  confidence          numeric(4,3) NOT NULL DEFAULT 1.0,
  observed_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, attribute_type, attribute_value, raw_lead_id)
);

CREATE INDEX mih_identity_nodes_lookup_idx ON mih.identity_nodes(org_id, attribute_type, attribute_value);
CREATE INDEX mih_identity_nodes_raw_lead_id_idx ON mih.identity_nodes(raw_lead_id);

ALTER TABLE mih.identity_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_identity_nodes_tenant_isolation ON mih.identity_nodes
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_identity_nodes_service_write ON mih.identity_nodes
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.identity_clusters — person/household clusters
-- -----------------------------------------------------------------
CREATE TABLE mih.identity_clusters (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cluster_type        text NOT NULL DEFAULT 'individual'
                        CHECK (cluster_type IN ('individual','household','suspect')),
  primary_node_id     uuid,  -- set after identity_nodes insert
  first_seen_at       timestamptz NOT NULL,
  last_activity_at    timestamptz NOT NULL,
  source_count        int NOT NULL DEFAULT 1,
  raw_lead_count      int NOT NULL DEFAULT 1,
  state               text NOT NULL DEFAULT 'active'
                        CHECK (state IN ('active','merged_into','split')),
  merged_into_id      uuid REFERENCES mih.identity_clusters(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mih_identity_clusters_org_state_idx ON mih.identity_clusters(org_id, state, last_activity_at DESC);

ALTER TABLE mih.identity_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_identity_clusters_tenant_isolation ON mih.identity_clusters
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_identity_clusters_service_write ON mih.identity_clusters
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.identity_edges — cluster ↔ node membership
-- -----------------------------------------------------------------
CREATE TABLE mih.identity_edges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cluster_id      uuid NOT NULL REFERENCES mih.identity_clusters(id) ON DELETE CASCADE,
  node_id         uuid NOT NULL REFERENCES mih.identity_nodes(id) ON DELETE CASCADE,
  edge_type       text NOT NULL CHECK (edge_type IN ('deterministic','fuzzy','household','manual')),
  confidence      numeric(4,3) NOT NULL,
  rule_applied    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  reversed_at     timestamptz,
  reversed_reason text,
  reversed_by     uuid,
  UNIQUE (cluster_id, node_id, edge_type) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX mih_identity_edges_cluster_id_idx ON mih.identity_edges(cluster_id);
CREATE INDEX mih_identity_edges_node_id_idx ON mih.identity_edges(node_id);

ALTER TABLE mih.identity_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_identity_edges_tenant_isolation ON mih.identity_edges
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_identity_edges_service_write ON mih.identity_edges
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.golden_records — canonical person view
-- -----------------------------------------------------------------
CREATE TABLE mih.golden_records (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cluster_id                uuid NOT NULL UNIQUE REFERENCES mih.identity_clusters(id) ON DELETE CASCADE,
  primary_phone             text NOT NULL,
  alt_phones                text[] NOT NULL DEFAULT '{}',
  primary_email             text,
  alt_emails                text[] NOT NULL DEFAULT '{}',
  primary_name              text,
  alt_names                 text[] NOT NULL DEFAULT '{}',
  household_members         jsonb,
  preference_consolidated   jsonb,
  first_touch_raw_lead_id   uuid REFERENCES mih.raw_inbox(id),
  first_touch_source_id     uuid REFERENCES mih.sources(id),
  first_touch_at            timestamptz,
  last_touch_raw_lead_id    uuid REFERENCES mih.raw_inbox(id),
  last_touch_source_id      uuid REFERENCES mih.sources(id),
  last_touch_at             timestamptz,
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mih_golden_records_org_phone_idx ON mih.golden_records(org_id, primary_phone);
CREATE INDEX mih_golden_records_cluster_id_idx ON mih.golden_records(cluster_id);

ALTER TABLE mih.golden_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_golden_records_tenant_isolation ON mih.golden_records
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_golden_records_service_write ON mih.golden_records
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.link_events — append-only identity resolution audit
-- -----------------------------------------------------------------
CREATE TABLE mih.link_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type        text NOT NULL CHECK (event_type IN (
                      'merge','unmerge','split','household_link','manual_override'
                    )),
  cluster_id        uuid,
  affected_clusters uuid[],
  rule_applied      text,
  confidence        numeric(4,3),
  triggered_by      text,
  details           jsonb,
  occurred_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mih_link_events_org_id_idx ON mih.link_events(org_id, occurred_at DESC);
CREATE INDEX mih_link_events_cluster_id_idx ON mih.link_events(cluster_id);

ALTER TABLE mih.link_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_link_events_tenant_isolation ON mih.link_events
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_link_events_service_write ON mih.link_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.dedup_rules_config — per-org dedup configuration
-- -----------------------------------------------------------------
CREATE TABLE mih.dedup_rules_config (
  org_id                        uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  dedup_window_days             int NOT NULL DEFAULT 60,
  fuzzy_name_threshold          numeric(4,3) NOT NULL DEFAULT 0.85,
  fuzzy_enabled                 boolean NOT NULL DEFAULT true,
  household_clustering_enabled  boolean NOT NULL DEFAULT true,
  household_window_days         int NOT NULL DEFAULT 30,
  manual_review_threshold       numeric(4,3) NOT NULL DEFAULT 0.70,
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mih.dedup_rules_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_dedup_rules_config_tenant_isolation ON mih.dedup_rules_config
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_dedup_rules_config_service_write ON mih.dedup_rules_config
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
