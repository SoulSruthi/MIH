-- Spec 07: Budget Plans
-- Alter existing budget stubs to match spec

ALTER TABLE mih.budgets ADD COLUMN IF NOT EXISTS plan_code text;
ALTER TABLE mih.budgets ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','in_review','approved','active','superseded','archived'));
ALTER TABLE mih.budgets ADD COLUMN IF NOT EXISTS total_booking_target_value bigint;
ALTER TABLE mih.budgets ADD COLUMN IF NOT EXISTS default_spend_pct numeric(5,4) DEFAULT 0.02;
ALTER TABLE mih.budgets ADD COLUMN IF NOT EXISTS total_marketing_budget bigint;
ALTER TABLE mih.budgets ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id);
ALTER TABLE mih.budgets ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE mih.budgets ADD COLUMN IF NOT EXISTS superseded_by_id uuid REFERENCES mih.budgets(id);
ALTER TABLE mih.budgets ADD COLUMN IF NOT EXISTS reason text;

-- budget_periods: alter to match spec
ALTER TABLE mih.budget_periods ADD COLUMN IF NOT EXISTS period_kind text NOT NULL DEFAULT 'month' CHECK (period_kind IN ('quarter','month','week'));
ALTER TABLE mih.budget_periods ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- New tables per spec
CREATE TABLE IF NOT EXISTS mih.budget_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  budget_id uuid NOT NULL REFERENCES mih.budgets(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES mih.budget_periods(id) ON DELETE CASCADE,
  project_id uuid REFERENCES mih.projects(id),
  medium text NOT NULL CHECK (medium IN ('online','btl','cp','referral','portals','branding','walk_in')),
  source_id uuid REFERENCES mih.sources(id),
  activity_id uuid REFERENCES mih.activities(id),
  allocation_basis text NOT NULL DEFAULT 'manual' CHECK (allocation_basis IN ('past_trend','manual','launch_boost','scenario')),
  amount_paise bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (budget_id, period_id, project_id, medium, source_id, activity_id)
);

CREATE TABLE IF NOT EXISTS mih.budget_actuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  budget_id uuid NOT NULL REFERENCES mih.budgets(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES mih.budget_periods(id) ON DELETE CASCADE,
  project_id uuid REFERENCES mih.projects(id),
  medium text,
  bookings_count_actual integer NOT NULL DEFAULT 0,
  bookings_value_actual bigint NOT NULL DEFAULT 0,
  spend_actual bigint NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (budget_id, period_id, project_id, medium)
);

-- Enable RLS
ALTER TABLE mih.budget_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mih.budget_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE mih.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mih.budget_periods ENABLE ROW LEVEL SECURITY;

-- RLS policies (org-scoped)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='budget_allocations' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.budget_allocations USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='budget_actuals' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.budget_actuals USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='budgets' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.budgets USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='budget_periods' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.budget_periods USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
END $$;
