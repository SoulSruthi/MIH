export type BudgetState =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'active'
  | 'superseded'
  | 'archived';

export type PeriodKind = 'quarter' | 'month' | 'week';

export type AllocationBasis = 'past_trend' | 'manual' | 'launch_boost' | 'scenario';

export type BudgetMedium =
  | 'online'
  | 'btl'
  | 'cp'
  | 'referral'
  | 'portals'
  | 'branding'
  | 'walk_in';

export type Budget = {
  id: string;
  org_id: string;
  project_id: string | null;
  fy_year: number;
  total_paise: number | null;
  notes: string | null;
  plan_code: string | null;
  state: BudgetState;
  total_booking_target_value: number | null;
  default_spend_pct: number | null;
  total_marketing_budget: number | null;
  approved_by: string | null;
  approved_at: string | null;
  superseded_by_id: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

export type BudgetPeriod = {
  id: string;
  org_id: string;
  budget_id: string;
  period_type: string;
  period_label: string;
  period_kind: PeriodKind;
  start_date: string;
  end_date: string;
  planned_paise: number | null;
  actual_paise: number | null;
  is_manual_override: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
};

export type BudgetAllocation = {
  id: string;
  org_id: string;
  budget_id: string;
  period_id: string;
  project_id: string | null;
  medium: BudgetMedium;
  source_id: string | null;
  activity_id: string | null;
  allocation_basis: AllocationBasis;
  amount_paise: number;
  created_at: string;
  updated_at: string;
};

export type BudgetActual = {
  id: string;
  org_id: string;
  budget_id: string;
  period_id: string;
  project_id: string | null;
  medium: string | null;
  bookings_count_actual: number;
  bookings_value_actual: number;
  spend_actual: number;
  refreshed_at: string;
  created_at: string;
};

export type BudgetVariance = {
  period_id: string;
  period_label: string;
  planned_paise: number;
  actual_paise: number;
  variance_paise: number;
  variance_pct: number | null;
};

export type CreateBudgetInput = {
  org_id: string;
  project_id?: string;
  fy_year: number;
  plan_code?: string;
  total_booking_target_value?: number;
  default_spend_pct?: number;
  notes?: string;
};

export type ActivateBudgetInput = {
  id: string;
  org_id: string;
  approved_by?: string;
};
