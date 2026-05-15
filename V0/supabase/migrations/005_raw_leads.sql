-- =================================================================
-- Migration: 005_raw_leads
-- Directive: M-005 Lead Ingestion Pipeline
-- Rule: ADDITIVE ONLY — NEVER UPDATE any raw_leads row after insert
-- =================================================================

-- app_org_id() and organizations/sources already created in 001+003.

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
  -- Idempotency: sha256 of canonical payload — prevents double-insert from retries
  payload_hash          text NOT NULL,
  raw_payload           jsonb NOT NULL,
  -- Dedup decision (written by dedup engine only — never updated elsewhere)
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

-- Immutability guard: prevents UPDATE on any column except dedup fields
-- (dedup engine is the only writer to dedup_status and unique_lead_id)
CREATE OR REPLACE FUNCTION raw_leads_immutability_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Allow only dedup engine fields to change
  IF (
    NEW.organization_id   IS DISTINCT FROM OLD.organization_id OR
    NEW.source_id         IS DISTINCT FROM OLD.source_id OR
    NEW.source_external_id IS DISTINCT FROM OLD.source_external_id OR
    NEW.phone_e164        IS DISTINCT FROM OLD.phone_e164 OR
    NEW.email             IS DISTINCT FROM OLD.email OR
    NEW.name              IS DISTINCT FROM OLD.name OR
    NEW.payload_hash      IS DISTINCT FROM OLD.payload_hash OR
    NEW.raw_payload       IS DISTINCT FROM OLD.raw_payload OR
    NEW.ingested_at       IS DISTINCT FROM OLD.ingested_at
  ) THEN
    RAISE EXCEPTION 'raw_leads core fields are immutable after insert';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER raw_leads_immutability
  BEFORE UPDATE ON raw_leads
  FOR EACH ROW EXECUTE FUNCTION raw_leads_immutability_guard();
