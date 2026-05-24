-- Spec 10: ROI Reporting

CREATE TABLE IF NOT EXISTS mih.spend_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  project_id uuid REFERENCES mih.projects(id),
  source_id uuid REFERENCES mih.sources(id),
  medium text CHECK (medium IN ('online','btl','cp','referral','portals','branding','walk_in')),
  entry_kind text NOT NULL CHECK (entry_kind IN ('api_pulled','manual','csv','invoice','recurring_amortized')),
  amount_paise bigint NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  ingestion_source text,
  external_ref text,
  description text,
  contract_id uuid,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (org_id, ingestion_source, external_ref)
);

CREATE TABLE IF NOT EXISTS mih.spend_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  project_id uuid REFERENCES mih.projects(id),
  source_id uuid REFERENCES mih.sources(id),
  vendor_name text NOT NULL,
  total_amount_paise bigint NOT NULL,
  amortization text NOT NULL CHECK (amortization IN ('monthly','weekly','one_time','custom')),
  contract_start date NOT NULL,
  contract_end date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  terminated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mih.metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  granularity text NOT NULL CHECK (granularity IN ('daily','weekly','monthly')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  dimension_key jsonb NOT NULL DEFAULT '{}',
  metric_set jsonb NOT NULL DEFAULT '{}',
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, granularity, period_start, dimension_key)
);

CREATE TABLE IF NOT EXISTS mih.variance_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  alert_type text NOT NULL CHECK (alert_type IN ('spend_overrun','booking_shortfall','cpb_spike','source_underperforming')),
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  project_id uuid REFERENCES mih.projects(id),
  source_id uuid REFERENCES mih.sources(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  context jsonb NOT NULL DEFAULT '{}',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mih.saved_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  report_type text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}',
  schedule jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mih.spend_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE mih.spend_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mih.metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE mih.variance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mih.saved_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='spend_entries' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.spend_entries USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='spend_contracts' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.spend_contracts USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='metric_snapshots' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.metric_snapshots USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='variance_alerts' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.variance_alerts USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='saved_reports' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.saved_reports USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
END $$;
