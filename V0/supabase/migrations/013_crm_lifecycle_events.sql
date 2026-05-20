-- =================================================================
-- Migration: 009_crm_lifecycle_events
-- Directive: M-009 CRM Event Inbox
-- Rule: ADDITIVE ONLY
-- =================================================================

-- -----------------------------------------------------------------
-- CRM LIFECYCLE EVENTS (immutable append-only log)
-- Receives lifecycle events from the AI CRM via POST /api/crm/events
-- -----------------------------------------------------------------

CREATE TABLE crm_lifecycle_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Idempotency: CRM retries with same event_id
  event_id          text NOT NULL,
  -- The unique_lead this event maps to (null when external_id is unknown)
  mih_unique_lead_id uuid REFERENCES unique_leads(id),
  -- The CRM lead this maps to (populated from payload)
  crm_lead_id       text,
  crm_external_id   text,
  event_kind        text NOT NULL
                      CHECK (event_kind IN (
                        'lead.received',
                        'lead.assigned',
                        'lead.contacted',
                        'lead.qualified',
                        'lead.lost',
                        'lead.junk',
                        'lead.site_visit_scheduled',
                        'lead.site_visit_completed',
                        'deal.created',
                        'deal.won',
                        'deal.lost'
                      )),
  source_product    text NOT NULL DEFAULT 'ai_crm',
  event_payload     jsonb NOT NULL DEFAULT '{}',
  received_at       timestamptz NOT NULL DEFAULT now(),
  -- Immutability: no UPDATE allowed — see trigger below
  UNIQUE (organization_id, event_id)
);

-- Prevent UPDATE on crm_lifecycle_events (append-only)
CREATE OR REPLACE FUNCTION crm_lifecycle_events_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'crm_lifecycle_events rows are immutable';
END;
$$;

CREATE TRIGGER crm_lifecycle_events_no_update
  BEFORE UPDATE ON crm_lifecycle_events
  FOR EACH ROW EXECUTE FUNCTION crm_lifecycle_events_immutable();

-- Indexes
CREATE INDEX crm_lifecycle_events_org_lead_idx
  ON crm_lifecycle_events(organization_id, mih_unique_lead_id)
  WHERE mih_unique_lead_id IS NOT NULL;

CREATE INDEX crm_lifecycle_events_org_kind_idx
  ON crm_lifecycle_events(organization_id, event_kind, received_at DESC);

CREATE INDEX crm_lifecycle_events_org_received_idx
  ON crm_lifecycle_events(organization_id, received_at DESC);

-- RLS
ALTER TABLE crm_lifecycle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_lifecycle_events_tenant_read ON crm_lifecycle_events
  FOR SELECT
  USING (organization_id = public.app_org_id());

CREATE POLICY crm_lifecycle_events_service_write ON crm_lifecycle_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- -----------------------------------------------------------------
-- ROLLBACK (reference — never run in forward migration)
-- =================================================================
-- DROP TABLE IF EXISTS crm_lifecycle_events CASCADE;
-- =================================================================
