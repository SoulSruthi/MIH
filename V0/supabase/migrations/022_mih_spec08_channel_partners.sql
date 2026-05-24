-- Spec 08: Channel Partners

ALTER TABLE mih.channel_partners ADD COLUMN IF NOT EXISTS cp_type text NOT NULL DEFAULT 'individual' CHECK (cp_type IN ('individual','firm','sub_broker'));
ALTER TABLE mih.channel_partners ADD COLUMN IF NOT EXISTS parent_cp_id uuid REFERENCES mih.channel_partners(id);
ALTER TABLE mih.channel_partners ADD COLUMN IF NOT EXISTS default_commission_pct numeric(5,4) NOT NULL DEFAULT 0.025;
ALTER TABLE mih.channel_partners ADD COLUMN IF NOT EXISTS rera_number text;
ALTER TABLE mih.channel_partners ADD COLUMN IF NOT EXISTS pan_number_encrypted text;
ALTER TABLE mih.channel_partners ADD COLUMN IF NOT EXISTS bank_details_encrypted text;

CREATE TABLE IF NOT EXISTS mih.cp_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  cp_id uuid NOT NULL REFERENCES mih.channel_partners(id) ON DELETE CASCADE,
  api_key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['leads:write'],
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mih.cp_commission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  cp_id uuid NOT NULL REFERENCES mih.channel_partners(id) ON DELETE CASCADE,
  project_id uuid REFERENCES mih.projects(id),
  slab_min_bookings integer NOT NULL DEFAULT 0,
  slab_max_bookings integer,
  commission_pct numeric(5,4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mih.cp_lead_pushes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  cp_id uuid NOT NULL REFERENCES mih.channel_partners(id),
  raw_inbox_id uuid REFERENCES mih.raw_inbox(id),
  outcome text NOT NULL CHECK (outcome IN ('accepted','dedup_existing','blocked_online_first','invalid')),
  pushed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mih.cp_commission_accruals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  cp_id uuid NOT NULL REFERENCES mih.channel_partners(id),
  attribution_result_id uuid REFERENCES mih.attribution_results(id),
  conversion_event_id uuid REFERENCES mih.conversion_events(id),
  project_id uuid REFERENCES mih.projects(id),
  booking_value bigint NOT NULL,
  commission_pct numeric(5,4) NOT NULL,
  commission_value bigint GENERATED ALWAYS AS (ROUND(booking_value * commission_pct)) STORED,
  state text NOT NULL DEFAULT 'earned' CHECK (state IN ('earned','accrued','approved','paid','reversed','disputed')),
  payout_reference text,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  paid_at timestamptz,
  reversed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mih.cp_fy_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  cp_id uuid NOT NULL REFERENCES mih.channel_partners(id),
  fy_year integer NOT NULL,
  target_bookings_count integer NOT NULL DEFAULT 0,
  target_bookings_value bigint NOT NULL DEFAULT 0,
  allocated_commission_budget bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, cp_id, fy_year)
);

ALTER TABLE mih.channel_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE mih.cp_commission_accruals ENABLE ROW LEVEL SECURITY;
ALTER TABLE mih.cp_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE mih.cp_commission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE mih.cp_lead_pushes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mih.cp_fy_targets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='channel_partners' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.channel_partners USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='cp_commission_accruals' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.cp_commission_accruals USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='cp_api_keys' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.cp_api_keys USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='cp_commission_overrides' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.cp_commission_overrides USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='cp_lead_pushes' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.cp_lead_pushes USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='cp_fy_targets' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.cp_fy_targets USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
END $$;
