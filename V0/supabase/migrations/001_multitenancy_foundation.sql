-- =================================================================
-- Migration: 001_multitenancy_foundation
-- Directive: M-001 Multi-Tenancy Foundation
-- Rule: ADDITIVE ONLY — no renames, no drops
-- =================================================================

-- -----------------------------------------------------------------
-- 1. app_org_id() — must be created before any RLS policy
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json->>'organization_id',
    ''
  )::uuid
$$;

-- -----------------------------------------------------------------
-- 2. Organizations (no RLS — platform table; app-layer filtered)
-- -----------------------------------------------------------------
CREATE TABLE organizations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  slug                  text NOT NULL UNIQUE,
  builder_brand         text,
  rera_number           text,
  gstin                 text,
  crm_organization_id   uuid,
  crm_base_url          text NOT NULL DEFAULT 'https://crm.builtrix.io',
  crm_api_token_id      uuid,
  crm_hmac_secret_id    uuid,
  tier                  text NOT NULL DEFAULT 'standard'
                          CHECK (tier IN ('standard','enterprise')),
  status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','suspended','deleted')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

-- -----------------------------------------------------------------
-- 3. Credentials (RLS — app-layer encrypted ciphertext only)
-- -----------------------------------------------------------------
CREATE TABLE credentials (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind                  text NOT NULL
                          CHECK (kind IN ('oauth_token','api_key','hmac_secret','bearer_token')),
  display_label         text NOT NULL,
  ciphertext            bytea NOT NULL,
  nonce                 bytea NOT NULL,
  rotated_at            timestamptz,
  expires_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY credentials_tenant_isolation ON credentials
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());

-- Deferred FKs from organizations → credentials (avoids circular ref at creation)
ALTER TABLE organizations
  ADD CONSTRAINT org_crm_api_token_fk
    FOREIGN KEY (crm_api_token_id) REFERENCES credentials(id),
  ADD CONSTRAINT org_crm_hmac_secret_fk
    FOREIGN KEY (crm_hmac_secret_id) REFERENCES credentials(id);

-- -----------------------------------------------------------------
-- 4. Memberships (RLS)
-- -----------------------------------------------------------------
CREATE TABLE memberships (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL,
  base_role             text NOT NULL
                          CHECK (base_role IN ('super_admin','org_user')),
  app_roles             text[] NOT NULL DEFAULT '{}',
  status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','suspended','removed')),
  invited_by            uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY memberships_tenant_isolation ON memberships
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());

-- -----------------------------------------------------------------
-- 5. Dedup rules (RLS — one row per org, created at provisioning)
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
CREATE POLICY dedup_rules_tenant_isolation ON dedup_rules
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());

-- -----------------------------------------------------------------
-- 6. Audit log (no RLS — service role only; immutable)
-- -----------------------------------------------------------------
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

-- Default partition for current month (bootstrap; nightly job manages future partitions)
CREATE TABLE audit_log_default PARTITION OF audit_log DEFAULT;

-- -----------------------------------------------------------------
-- 7. provision_mih_org() RPC
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provision_mih_org(
  p_org_name            text,
  p_slug                text,
  p_owner_user_id       uuid,
  p_crm_organization_id uuid DEFAULT NULL,
  p_crm_base_url        text DEFAULT 'https://crm.builtrix.io'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Insert org
  INSERT INTO organizations (name, slug, crm_organization_id, crm_base_url)
  VALUES (p_org_name, p_slug, p_crm_organization_id, p_crm_base_url)
  RETURNING id INTO v_org_id;

  -- Insert membership (owner as mih_org_admin)
  INSERT INTO memberships (organization_id, user_id, base_role, app_roles)
  VALUES (v_org_id, p_owner_user_id, 'org_user', ARRAY['mih_org_admin']);

  -- Insert dedup_rules defaults
  INSERT INTO dedup_rules (organization_id)
  VALUES (v_org_id);

  -- Fire audit row
  INSERT INTO audit_log (organization_id, actor_id, actor_type, action, after_state)
  VALUES (
    v_org_id,
    p_owner_user_id,
    'system',
    'org.provisioned',
    jsonb_build_object('org_id', v_org_id, 'slug', p_slug)
  );

  RETURN jsonb_build_object('org_id', v_org_id);
END;
$$;

-- -----------------------------------------------------------------
-- 8. Tenant-leak audit schema + function
-- -----------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS audit;

CREATE OR REPLACE FUNCTION audit.tenant_leak_check()
RETURNS TABLE (table_name text, issue text, example_id text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- NULL organization_id in tenant-scoped tables
  RETURN QUERY
    SELECT 'memberships'::text, 'NULL organization_id'::text, id::text
    FROM memberships WHERE organization_id IS NULL LIMIT 1;

  RETURN QUERY
    SELECT 'credentials'::text, 'NULL organization_id'::text, id::text
    FROM credentials WHERE organization_id IS NULL LIMIT 1;

  RETURN QUERY
    SELECT 'dedup_rules'::text, 'NULL organization_id'::text, id::text
    FROM dedup_rules WHERE organization_id IS NULL LIMIT 1;

  -- organization_id referencing deleted/non-existent org
  RETURN QUERY
    SELECT 'memberships'::text, 'orphan organization_id'::text, m.id::text
    FROM memberships m
    LEFT JOIN organizations o ON m.organization_id = o.id
    WHERE o.id IS NULL LIMIT 1;

  RETURN QUERY
    SELECT 'credentials'::text, 'orphan organization_id'::text, c.id::text
    FROM credentials c
    LEFT JOIN organizations o ON c.organization_id = o.id
    WHERE o.id IS NULL LIMIT 1;

END;
$$;
