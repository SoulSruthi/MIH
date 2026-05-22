import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type {
  Budget,
  BudgetPeriod,
  BudgetVariance,
  CreateBudgetInput,
  ActivateBudgetInput,
} from './types';

export async function createBudget(input: CreateBudgetInput): Promise<Budget> {
  const supabase = getSupabaseAdmin();

  const totalMarketingBudget =
    input.total_booking_target_value && input.default_spend_pct
      ? Math.round(input.total_booking_target_value * input.default_spend_pct)
      : null;

  const { data, error } = await supabase
    .schema('mih')
    .from('budgets')
    .insert({
      org_id: input.org_id,
      project_id: input.project_id ?? null,
      fy_year: input.fy_year,
      plan_code: input.plan_code ?? null,
      total_booking_target_value: input.total_booking_target_value ?? null,
      default_spend_pct: input.default_spend_pct ?? 0.02,
      total_marketing_budget: totalMarketingBudget,
      notes: input.notes ?? null,
      state: 'draft',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Budget;
}

export async function getBudget(id: string, orgId: string): Promise<Budget | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('budgets')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (error) return null;
  return data as Budget;
}

export async function listBudgets(orgId: string): Promise<Budget[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('budgets')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Budget[];
}

export async function updateBudget(
  id: string,
  orgId: string,
  updates: Partial<Budget>,
): Promise<Budget> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('budgets')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Budget;
}

export async function activateBudget(input: ActivateBudgetInput): Promise<Budget> {
  const supabase = getSupabaseAdmin();

  const existing = await getBudget(input.id, input.org_id);
  if (!existing) throw new Error('Budget not found');
  if (!['approved', 'in_review', 'draft'].includes(existing.state)) {
    throw new Error(`Cannot activate budget in state: ${existing.state}`);
  }

  const { data, error } = await supabase
    .schema('mih')
    .from('budgets')
    .update({
      state: 'active',
      approved_by: input.approved_by ?? null,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .eq('org_id', input.org_id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Budget;
}

export async function getBudgetPeriods(
  budgetId: string,
  orgId: string,
): Promise<BudgetPeriod[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('budget_periods')
    .select('*')
    .eq('budget_id', budgetId)
    .eq('org_id', orgId)
    .order('start_date', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as BudgetPeriod[];
}

export async function getVariance(
  budgetId: string,
  orgId: string,
): Promise<BudgetVariance[]> {
  const supabase = getSupabaseAdmin();

  const { data: periods, error: periodsError } = await supabase
    .schema('mih')
    .from('budget_periods')
    .select('id, period_label, planned_paise, actual_paise')
    .eq('budget_id', budgetId)
    .eq('org_id', orgId)
    .order('start_date', { ascending: true });

  if (periodsError) throw new Error(periodsError.message);

  return (periods ?? []).map((p) => {
    const planned = p.planned_paise ?? 0;
    const actual = p.actual_paise ?? 0;
    const variance = actual - planned;
    const variancePct = planned !== 0 ? (variance / planned) * 100 : null;
    return {
      period_id: p.id,
      period_label: p.period_label,
      planned_paise: planned,
      actual_paise: actual,
      variance_paise: variance,
      variance_pct: variancePct,
    };
  });
}

export async function updateActuals(
  budgetId: string,
  periodId: string,
  orgId: string,
  actuals: {
    bookings_count_actual?: number;
    bookings_value_actual?: number;
    spend_actual?: number;
  },
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const actualPaise = actuals.spend_actual ?? 0;

  await supabase
    .schema('mih')
    .from('budget_actuals')
    .upsert(
      {
        org_id: orgId,
        budget_id: budgetId,
        period_id: periodId,
        bookings_count_actual: actuals.bookings_count_actual ?? 0,
        bookings_value_actual: actuals.bookings_value_actual ?? 0,
        spend_actual: actualPaise,
        refreshed_at: new Date().toISOString(),
      },
      { onConflict: 'budget_id,period_id,project_id,medium' },
    );

  await supabase
    .schema('mih')
    .from('budget_periods')
    .update({ actual_paise: actualPaise, updated_at: new Date().toISOString() })
    .eq('id', periodId)
    .eq('org_id', orgId);
}
