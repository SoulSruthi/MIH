-- Spec 09: Referral Program

ALTER TABLE mih.referrers ADD COLUMN IF NOT EXISTS referrer_code text UNIQUE;
ALTER TABLE mih.referrers ADD COLUMN IF NOT EXISTS crm_customer_id text;
ALTER TABLE mih.referrers ADD COLUMN IF NOT EXISTS first_booking_at timestamptz;
ALTER TABLE mih.referrers ADD COLUMN IF NOT EXISTS bookings_count integer NOT NULL DEFAULT 0;
ALTER TABLE mih.referrers ADD COLUMN IF NOT EXISTS consent_state text NOT NULL DEFAULT 'pending' CHECK (consent_state IN ('pending','opted_in','opted_out','revoked'));
ALTER TABLE mih.referrers ADD COLUMN IF NOT EXISTS consent_channels text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE mih.referrers ADD COLUMN IF NOT EXISTS default_commission_pct numeric(5,4) NOT NULL DEFAULT 0.015;
ALTER TABLE mih.referrers ADD COLUMN IF NOT EXISTS reward_preference text NOT NULL DEFAULT 'cash' CHECK (reward_preference IN ('cash','voucher','white_goods','choice'));

CREATE TABLE IF NOT EXISTS mih.referral_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  referrer_id uuid NOT NULL REFERENCES mih.referrers(id),
  raw_inbox_id uuid REFERENCES mih.raw_inbox(id),
  outcome text NOT NULL CHECK (outcome IN ('accepted','dedup_existing','blocked_other_source_first','invalid')),
  submission_channel text NOT NULL DEFAULT 'webform' CHECK (submission_channel IN ('portal','webform','sms_reply','whatsapp','ops_manual')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mih.referral_commission_accruals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  referrer_id uuid NOT NULL REFERENCES mih.referrers(id),
  attribution_result_id uuid REFERENCES mih.attribution_results(id),
  conversion_event_id uuid REFERENCES mih.conversion_events(id),
  project_id uuid REFERENCES mih.projects(id),
  booking_value bigint NOT NULL,
  commission_pct numeric(5,4) NOT NULL,
  commission_value bigint GENERATED ALWAYS AS (ROUND(booking_value * commission_pct)) STORED,
  reward_kind text NOT NULL DEFAULT 'cash',
  state text NOT NULL DEFAULT 'earned' CHECK (state IN ('earned','accrued','approved','paid','reversed','disputed')),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  paid_at timestamptz,
  reversed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mih.referrers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mih.referral_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mih.referral_commission_accruals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='referrers' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.referrers USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='referral_submissions' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.referral_submissions USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='referral_commission_accruals' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.referral_commission_accruals USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
END $$;
