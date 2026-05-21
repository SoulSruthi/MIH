-- =================================================================
-- Migration: 021_mih_spec07_budgets
-- Purpose: Budget Planning Engine tables (Spec 07 V0)
-- Rule: ADDITIVE ONLY — never modify existing tables
-- =================================================================

-- -----------------------------------------------------------------
-- mih.budgets — annual budget envelope per project per FY
-- -----------------------------------------------------------------
CREATE TABLE mih.budgets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id          uuid NOT NULL REFERENCES mih.projects(id) ON DELETE CASCADE,
  fy_year             int NOT NULL,  -- financial year start year, e.g. 2026 for FY2026-27
  total_paise         bigint NOT NULL CHECK (total_paise >= 0),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, project_id, fy_year)
);

CREATE INDEX mih_budgets_org_project_idx ON mih.budgets(org_id, project_id);
CREATE INDEX mih_budgets_org_fy_idx ON mih.budgets(org_id, fy_year);

ALTER TABLE mih.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_budgets_tenant_isolation ON mih.budgets
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_budgets_service_write ON mih.budgets
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.budget_periods — time-sliced sub-allocations of a budget
-- Hierarchy: annual → quarterly → monthly → weekly
-- -----------------------------------------------------------------
CREATE TABLE mih.budget_periods (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  budget_id           uuid NOT NULL REFERENCES mih.budgets(id) ON DELETE CASCADE,
  period_type         text NOT NULL CHECK (period_type IN ('annual','quarterly','monthly','weekly')),
  period_label        text NOT NULL,  -- e.g. 'Annual FY2026', 'Q1 FY2026', 'Apr 2026', 'Week 01 FY2026'
  start_date          date NOT NULL,
  end_date            date NOT NULL,
  planned_paise       bigint NOT NULL DEFAULT 0 CHECK (planned_paise >= 0),
  actual_paise        bigint NOT NULL DEFAULT 0 CHECK (actual_paise >= 0),
  is_manual_override  boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (budget_id, period_type, start_date)
);

CREATE INDEX mih_budget_periods_budget_idx ON mih.budget_periods(budget_id, period_type);
CREATE INDEX mih_budget_periods_date_idx ON mih.budget_periods(org_id, start_date, end_date);

ALTER TABLE mih.budget_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_budget_periods_tenant_isolation ON mih.budget_periods
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_budget_periods_service_write ON mih.budget_periods
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- mih.budget_reallocation_log — audit trail for every budget move
-- -----------------------------------------------------------------
CREATE TABLE mih.budget_reallocation_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  budget_id           uuid NOT NULL REFERENCES mih.budgets(id) ON DELETE CASCADE,
  from_period_id      uuid NOT NULL REFERENCES mih.budget_periods(id),
  to_period_id        uuid NOT NULL REFERENCES mih.budget_periods(id),
  amount_paise        bigint NOT NULL CHECK (amount_paise > 0),
  reason              text,
  reallocated_by      uuid,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mih_budget_reallocation_log_budget_idx ON mih.budget_reallocation_log(budget_id, created_at DESC);

ALTER TABLE mih.budget_reallocation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY mih_budget_reallocation_log_tenant_isolation ON mih.budget_reallocation_log
  USING (org_id = public.app_org_id())
  WITH CHECK (org_id = public.app_org_id());

CREATE POLICY mih_budget_reallocation_log_service_write ON mih.budget_reallocation_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
