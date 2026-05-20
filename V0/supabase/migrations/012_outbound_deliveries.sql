-- =================================================================
-- Migration: 008_outbound_deliveries
-- Directive: M-008 CRM Handoff Worker
-- Rule: ADDITIVE ONLY
-- =================================================================

-- -----------------------------------------------------------------
-- OUTBOUND DELIVERIES (one row per CRM POST attempt)
-- -----------------------------------------------------------------

CREATE TABLE outbound_deliveries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  unique_lead_id    uuid NOT NULL REFERENCES unique_leads(id) ON DELETE CASCADE,
  target            text NOT NULL DEFAULT 'crm'
                      CHECK (target IN ('crm')),
  endpoint_url      text NOT NULL,
  idempotency_key   text NOT NULL,
  attempt_number    int  NOT NULL DEFAULT 1 CHECK (attempt_number BETWEEN 1 AND 8),
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','in_flight','succeeded','failed','skipped')),
  http_status       int,
  response_body     text,          -- truncated to 500 chars at write time
  error_message     text,
  attempted_at      timestamptz NOT NULL DEFAULT now(),
  next_retry_at     timestamptz,
  UNIQUE (organization_id, idempotency_key, attempt_number)
);

CREATE INDEX outbound_deliveries_org_lead_idx
  ON outbound_deliveries(organization_id, unique_lead_id);

CREATE INDEX outbound_deliveries_org_status_idx
  ON outbound_deliveries(organization_id, status)
  WHERE status IN ('pending','in_flight');

ALTER TABLE outbound_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY outbound_deliveries_tenant_read ON outbound_deliveries
  FOR SELECT
  USING (organization_id = public.app_org_id());

CREATE POLICY outbound_deliveries_service_write ON outbound_deliveries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------
-- CRM CIRCUIT BREAKER STATE (one row per org)
-- Tracks consecutive 5xx failures per CRM base_url
-- -----------------------------------------------------------------

CREATE TABLE crm_circuit_breaker (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  crm_base_url        text NOT NULL,
  state               text NOT NULL DEFAULT 'closed'
                        CHECK (state IN ('closed','open','half_open')),
  consecutive_failures int NOT NULL DEFAULT 0,
  opened_at           timestamptz,
  close_after         timestamptz,
  last_checked_at     timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_circuit_breaker ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_circuit_breaker_service_all ON crm_circuit_breaker
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION crm_circuit_breaker_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER crm_circuit_breaker_updated_at
  BEFORE UPDATE ON crm_circuit_breaker
  FOR EACH ROW EXECUTE FUNCTION crm_circuit_breaker_set_updated_at();

-- -----------------------------------------------------------------
-- ROLLBACK (reference — never run in forward migration)
-- =================================================================
-- DROP TABLE IF EXISTS crm_circuit_breaker CASCADE;
-- DROP TABLE IF EXISTS outbound_deliveries CASCADE;
-- =================================================================
